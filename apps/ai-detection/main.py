import base64
import io
import time
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image, ImageOps, ImageEnhance
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
        # Pass 1: Standard inference with lowered confidence threshold for ESP32-CAM (0.12)
        results = model.predict(img, conf=0.12, imgsz=640, verbose=False)
        
        person_detections = []
        conf_sum = 0.0
        
        if len(results) > 0:
            result = results[0]
            boxes = result.boxes
            
            for box in boxes:
                cls_id = int(box.cls[0].item())
                # Class 0 in COCO dataset is "person"
                if cls_id == 0:
                    conf = float(box.conf[0].item())
                    xyxy = box.xyxy[0].tolist()
                    
                    person_detections.append(DetectionInfo(
                        box=xyxy,
                        confidence=conf
                    ))
                    conf_sum += conf

        # Pass 2: Low-Light Shadow & Contrast Amplification
        # If fewer than 2 persons detected or low confidence, apply multi-stage enhancement (Equalization + Brightness Boost)
        if len(person_detections) < 2:
            # Boost brightness & equalize dark histograms
            equalized_img = ImageOps.equalize(img)
            brightener = ImageEnhance.Brightness(equalized_img)
            boosted_img = brightener.enhance(1.4)
            contraster = ImageEnhance.Contrast(boosted_img)
            enhanced_img = contraster.enhance(1.3)

            results_enhanced = model.predict(enhanced_img, conf=0.08, imgsz=640, verbose=False)
            if len(results_enhanced) > 0:
                result = results_enhanced[0]
                boxes = result.boxes
                
                enhanced_detections = []
                enhanced_conf_sum = 0.0
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    if cls_id == 0:
                        conf = float(box.conf[0].item())
                        xyxy = box.xyxy[0].tolist()
                        enhanced_detections.append(DetectionInfo(
                            box=xyxy,
                            confidence=conf
                        ))
                        enhanced_conf_sum += conf
                
                # If enhanced image found more valid persons, adopt the enhanced detections
                if len(enhanced_detections) > len(person_detections):
                    person_detections = enhanced_detections
                    conf_sum = enhanced_conf_sum
        
        person_count = len(person_detections)
        avg_confidence = (conf_sum / person_count) if person_count > 0 else 0.0
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        print(f"[YOLO11n] Detected {person_count} persons in {processing_time_ms}ms with avg confidence {avg_confidence:.2f}")
        
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
