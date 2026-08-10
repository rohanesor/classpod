import base64
import io
import time
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image, ImageOps, ImageEnhance
import numpy as np
from ultralytics import YOLO

app = FastAPI(title="ClassPod AI Detection Service")

# Load YOLO11n model. It will auto-download the weights on first run.
print("Loading YOLO11n model...")
model = YOLO("yolo11n.pt")
print("YOLO11n model loaded successfully.")

class DetectionRequest(BaseModel):
    image: str

class DetectionInfo(BaseModel):
    box: List[float]
    confidence: float

class DetectionResponse(BaseModel):
    personCount: int
    confidence: float
    detections: List[DetectionInfo]
    processingTimeMs: int

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ai-detection",
        "model": "yolo11n.pt",
        "timestamp": time.time()
    }

def calculate_iou(box1: List[float], box2: List[float]) -> float:
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_area = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[0])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[0])
    union_area = area1 + area2 - inter_area

    if union_area <= 0:
        return 0.0
    return inter_area / union_area

def is_nested(box_child: List[float], box_parent: List[float], threshold: float = 0.60) -> bool:
    x1 = max(box_child[0], box_parent[0])
    y1 = max(box_child[1], box_parent[1])
    x2 = min(box_child[2], box_parent[2])
    y2 = min(box_child[3], box_parent[3])

    inter_area = max(0, x2 - x1) * max(0, y2 - y1)
    child_area = (box_child[2] - box_child[0]) * (box_child[3] - box_child[1])
    parent_area = (box_parent[2] - box_parent[0]) * (box_parent[3] - box_parent[1])

    if child_area <= 0:
        return False
    return (inter_area / child_area) >= threshold and child_area < parent_area

def suppress_nested_detections(detections: List[DetectionInfo]) -> List[DetectionInfo]:
    if len(detections) <= 1:
        return detections

    # Sort boxes by area descending (largest person body boxes first)
    sorted_dets = sorted(
        detections,
        key=lambda d: (d.box[2] - d.box[0]) * (d.box[3] - d.box[1]),
        reverse=True,
    )

    kept: List[DetectionInfo] = []
    for candidate in sorted_dets:
        is_duplicate = False
        for master in kept:
            if is_nested(candidate.box, master.box, 0.60) or calculate_iou(candidate.box, master.box) > 0.75:
                is_duplicate = True
                break
        if not is_duplicate:
            kept.append(candidate)

    return kept

def apply_soft_nms(
    detections: List[DetectionInfo],
    sigma: float = 0.5,
    score_thresh: float = 0.08,
) -> List[DetectionInfo]:
    """
    Gaussian Soft-NMS: Decays confidence scores of overlapping boxes instead of deleting them.
    Preserves students sitting directly behind one another in tight rows.
    """
    if len(detections) <= 1:
        return detections

    boxes = np.array([d.box for d in detections], dtype=np.float32)
    scores = np.array([d.confidence for d in detections], dtype=np.float32)

    N = len(boxes)
    indexes = np.arange(N)

    for i in range(N):
        max_idx = i + np.argmax(scores[i:])
        # Swap
        scores[[i, max_idx]] = scores[[max_idx, i]]
        boxes[[i, max_idx]] = boxes[[max_idx, i]]
        indexes[[i, max_idx]] = indexes[[max_idx, i]]

        pos_box = boxes[i]
        pos_score = scores[i]

        if pos_score < score_thresh:
            break

        # IoU with remaining boxes
        x1 = np.maximum(pos_box[0], boxes[i+1:, 0])
        y1 = np.maximum(pos_box[1], boxes[i+1:, 1])
        x2 = np.minimum(pos_box[2], boxes[i+1:, 2])
        y2 = np.minimum(pos_box[3], boxes[i+1:, 3])

        inter_area = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)
        area1 = (pos_box[2] - pos_box[0]) * (pos_box[3] - pos_box[1])
        area2 = (boxes[i+1:, 2] - boxes[i+1:, 0]) * (boxes[i+1:, 3] - boxes[i+1:, 1])
        union_area = area1 + area2 - inter_area
        iou = inter_area / np.maximum(union_area, 1e-6)

        # Apply Gaussian decay weighting
        weight = np.exp(-(iou ** 2) / sigma)
        scores[i+1:] = scores[i+1:] * weight

    kept_indices = np.where(scores >= score_thresh)[0]
    return [
        DetectionInfo(box=boxes[idx].tolist(), confidence=float(scores[idx]))
        for idx in kept_indices
    ]

import numpy as np

@app.post("/detect", response_model=DetectionResponse)
async def detect_persons(request: DetectionRequest):
    start_time = time.time()
    
    try:
        # Strip potential Data URI header
        base64_str = request.image
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
            
        # Decode base64 bytes
        img_bytes = base64.b64decode(base64_str)
        raw_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img = ImageOps.exif_transpose(raw_img)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format or decoding failed: {str(e)}")
        
    try:
        # Motion sharpening for dynamic movement resilience
        sharpener = ImageEnhance.Sharpness(img)
        sharpened_img = sharpener.enhance(1.3)

        # Pass 1: Standard inference with lowered confidence threshold for ESP32-CAM (0.12)
        results = model.predict(sharpened_img, conf=0.10, imgsz=640, verbose=False)
        
        raw_detections = []
        
        if len(results) > 0:
            result = results[0]
            boxes = result.boxes
            
            for box in boxes:
                cls_id = int(box.cls[0].item())
                # Class 0 in COCO dataset is "person"
                if cls_id == 0:
                    conf = float(box.conf[0].item())
                    xyxy = box.xyxy[0].tolist()
                    
                    raw_detections.append(DetectionInfo(
                        box=xyxy,
                        confidence=conf
                    ))

        # Apply Perspective Tiling SAHI on distant top 40% region if image is sufficiently high-res
        w_img, h_img = sharpened_img.size
        if h_img >= 400 and len(raw_detections) > 0:
            # Crop distant top-half band and re-infer at high density
            top_band = sharpened_img.crop((0, 0, w_img, int(h_img * 0.45)))
            results_top = model.predict(top_band, conf=0.08, imgsz=640, verbose=False)
            if len(results_top) > 0:
                for box in results_top[0].boxes:
                    if int(box.cls[0].item()) == 0:
                        conf = float(box.conf[0].item())
                        xyxy = box.xyxy[0].tolist()
                        # Map tile coordinates back to original frame
                        raw_detections.append(DetectionInfo(
                            box=xyxy,
                            confidence=conf
                        ))

        # Apply anatomical nested box suppression (filters raised hand / arm splits)
        clean_detections = suppress_nested_detections(raw_detections)

        # Apply Gaussian Soft-NMS (preserves overlapping back-row students)
        person_detections = apply_soft_nms(clean_detections, sigma=0.5, score_thresh=0.08)

        # Pass 2: Low-Light Shadow & Contrast Amplification
        # If fewer than 2 persons detected, apply multi-stage enhancement (Equalization + Brightness Boost)
        if len(person_detections) < 2:
            equalized_img = ImageOps.equalize(sharpened_img)
            brightener = ImageEnhance.Brightness(equalized_img)
            boosted_img = brightener.enhance(1.4)
            contraster = ImageEnhance.Contrast(boosted_img)
            enhanced_img = contraster.enhance(1.3)

            results_enhanced = model.predict(enhanced_img, conf=0.08, imgsz=640, verbose=False)
            if len(results_enhanced) > 0:
                result = results_enhanced[0]
                boxes = result.boxes
                
                enhanced_detections = []
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    if cls_id == 0:
                        conf = float(box.conf[0].item())
                        xyxy = box.xyxy[0].tolist()
                        enhanced_detections.append(DetectionInfo(
                            box=xyxy,
                            confidence=conf
                        ))
                
                enhanced_clean = suppress_nested_detections(enhanced_detections)
                enhanced_soft = apply_soft_nms(enhanced_clean, sigma=0.5, score_thresh=0.08)

                # If enhanced image found more valid persons, adopt the enhanced detections
                if len(enhanced_soft) > len(person_detections):
                    person_detections = enhanced_soft

        person_count = len(person_detections)
        conf_sum = sum(d.confidence for d in person_detections)
        avg_confidence = (conf_sum / person_count) if person_count > 0 else 0.0
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        print(f"[DualHead-YOLO] Detected {person_count} persons in {processing_time_ms}ms with avg confidence {avg_confidence:.2f}")
        
        return DetectionResponse(
            personCount=person_count,
            confidence=avg_confidence,
            detections=person_detections,
            processingTimeMs=processing_time_ms
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
