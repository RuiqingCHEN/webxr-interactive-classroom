# WebXR Interactive Classroom

An interactive virtual learning environment built with **Three.js** and **WebXR**, 
simulating a classroom / lecture hall experience with VR support, animated characters, 
spatial audio, and video playback.

> This project **requires a VR-capable browser and device** to experience full functionality.

---

## Features

- **Virtual Classroom Environment**
  - Fully modeled classroom including floor, walls, furniture, windows, and lighting
  - Dynamic elements such as rain effects and a real-time wall clock

- **WebXR VR Support**
  - Enter VR mode via WebXR-compatible browsers
  - VR controllers with ray-based interaction
  - Interactive in-world play button for video control

- **Animated Characters**
  - Two independently animated characters loaded via `GLTFLoader`
  - Separate animation states and positioning

- **Video Playback System**
  - Video projected onto a virtual screen using a `THREE.VideoTexture`
  - Keyboard and VR-controller controlled playback

- **Spatial Audio**
  - Positional audio using `THREE.PositionalAudio`
  - Adjustable volume and pitch via GUI

- **Custom Shaders**
  - Glass material with animated raindrop effect
  - Dynamic desk material
  - Wavy deformation shader
  - Glow shader for audio source visualization

- **Debug & Control Tools**
  - Real-time performance monitoring with `Stats.js`
  - Interactive controls via `dat.GUI`

---

## Requirements

- A **WebXR-compatible browser** (e.g. Chrome, Edge)
- A **VR headset** (Quest / PC VR)
- Local web server (required for video, audio, and WebXR)

---

## How to Run

This project **must be run via a local web server**.

VS Code Live Server (Recommended)
1. Open the project folder in VS Code
2. Install the **Live Server** extension
3. Right-click `index.html` → **Open with Live Server**
4. Click **Enter VR** in the browser (with headset connected)


## Screenshots
<img width="1247" height="658" alt="微信图片_20260108214454" src="https://github.com/user-attachments/assets/d8ecd2f5-05ae-4402-ab85-f1962641e5c1" />

