'use client';

import React from 'react';
import Link from 'next/link';
import { Smartphone, Download, CheckCircle2, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        
        {/* Back Link */}
        <Link href="/" className="inline-flex items-center text-xs text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
        </Link>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/40 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/10">
            <Smartphone className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CLASSPOD MOBILE APP</h1>
          <p className="text-xs text-slate-400">One unified Android app for Students & Teachers</p>
        </div>

        {/* Download Buttons */}
        <div className="space-y-3">
          <a
            href="https://github.com/rohanesor/classpod/releases/latest/download/app-release.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all transform active:scale-95"
          >
            <Download className="w-5 h-5" />
            <span>Download Android App (.apk)</span>
          </a>

          <a
            href="https://github.com/rohanesor/classpod/releases/latest/download/ClassPod.ipa"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all transform active:scale-95"
          >
            <Download className="w-5 h-5" />
            <span>Download iOS Package (.ipa)</span>
          </a>

          <a
            href="/api/download/apk"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl flex items-center justify-center space-x-2 border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Android Direct Server Mirror</span>
          </a>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>Version: v2.1.0-release</span>
            <span>Android APK & iOS IPA</span>
          </div>
        </div>

        {/* Roles Feature List */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div>
            <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Student Experience</h3>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Automated 1-Device Binding (Installation UUID)</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>ESP32 Classroom BLE Proximity Scanning</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Anti-Proxy Attendance Verification Status</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Teacher Experience</h3>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>1-Click Session Start & BLE Gateway Activation</span>
              </li>
              <li className="flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Live AI Headcount vs Student BLE Check-In Telemetry</span>
              </li>
              <li className="flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Real-Time <b>⚠ PROXY RISK DETECTED</b> Alerts</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-[11px] text-center text-slate-500">
          Install the ClassPod Student & Teacher App to participate in BLE-verified classroom attendance. Role is determined automatically after login.
        </p>

      </div>
    </div>
  );
}
