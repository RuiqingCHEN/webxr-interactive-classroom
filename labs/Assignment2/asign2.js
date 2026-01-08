// Name: Ruiqing CHEN
// Student number: 124107923
import * as THREE from 'three';
import { GUI } from '../../libs/dat.gui.module.js';
import Stats from '../../libs/stats.module.js';
import { OrbitControls } from '../../libs/OrbitControls.js';
import { EXRLoader } from '../../libs/EXRLoader.js';
import { GLTFLoader } from '../../libs/GLTFLoader.js';
import { Water } from '../../libs/Water.js';
import { VRButton } from '../../libs/VRButton.js';
import { XRControllerModelFactory } from '../../libs/XRControllerModelFactory.js';
import * as CANNON from '../../libs/cannon-es.js';

class App {
  constructor() {
    this.container = document.getElementById('container');
    this.clock = new THREE.Clock();
    this.stats = new Stats();
    this.stats.showPanel(0);
    this.container.appendChild(this.stats.dom);

    this.video = document.getElementById('video');
    this.video.load();
    this.gui = new GUI();

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.mixers = [];
    this.controllers = [];

    this.modelPath1 = '../../assets/model1.glb';
    this.modelPath2 = '../../assets/model2.glb';
    this.soundFile = '../../assets/sound1.mp3';

    this.bulbLuminousPowers = {
      '110000 lm (1000W)': 110000,
      '3500 lm (300W)': 3500,
      '1700 lm (100W)': 1700,
      '800 lm (60W)': 800,
      '400 lm (40W)': 400,
      '180 lm (25W)': 180,
      '20 lm (4W)': 20,
      'Off': 0
    };
    this.bulbParams = {
      shadows: true,
      exposure: 1.0,
      bulbPower: Object.keys(this.bulbLuminousPowers)[4],
      bulbColor: 0xffee88
    };
    this.audioControls = {
      volume: 1.0,
      pitch: 1.0,
      isPlaying: false,
      togglePlay: () => this.toggleAudioPlay()
    };

    // Cloth simulation parameters
    this.clothMass = 2;
    this.clothSize = 40;
    this.Nx = 24;
    this.Ny = 24;
    this.mass = (this.clothMass / this.Nx) * this.Ny;
    this.restDistance = this.clothSize / this.Nx;
    this.sphereSize = 4;
    this.movementRadius = 8;
    this.particles = [];

    this.physics();
    this.init();
  }

  init() {
    this.createScene();
    this.createRenderer();
    this.createCamera();
    this.setupEventListeners();

    this.createFloor();
    this.createWalls();
    this.desk = this.createTeacherDesk();
    this.createDesks();
    this.createChairs();
    console.log("Classroom loaded successfully");

    this.createProjector();
    this.createVideoProjection();
    this.createProjectionScreen();
    console.log("Video and projection screen loaded successfully");

    this.initWithClock();
    this.createSphere();
    console.log("Clock loaded successfully");

    this.createLight();
    this.createCeilingLights();
    this.createBulb();
    this.createSpotLight();
    console.log("Lights loaded successfully");

    this.createWater();
    console.log("Environmental water surface loaded successfully");

    this.setupSpatialSound();
    console.log("Spatial sound loaded successfully");

    this.loadCharacter(this.modelPath1, { x: 15, y: 15, z: 15 }, { x: 40, y: 0, z: -45 });
    this.loadCharacter(this.modelPath2, { x: 0.2, y: 0.2, z: 0.2 }, { x: -40, y: 0, z: -45 });
    console.log("Characters loaded successfully");

    this.createControlPanel();
    this.createXR();

    this.initCloth();

    const axesHelper = new THREE.AxesHelper(20);
    this.scene.add(axesHelper);

    this.renderer.setAnimationLoop(() => this.animate());
  }

  createScene() {
    this.scene = new THREE.Scene();
    const exrLoader = new EXRLoader();
    exrLoader.load('../../assets/textures/aristea_wreck_puresky_4k.exr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.background = texture;
  });
  }

  createRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = Math.pow(this.bulbParams.exposure, 2.0);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  createCamera() {
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.01, 1000);
    this.camera.position.set(0, 50, 150);
    this.scene.add(this.camera);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize(), false);
    document.addEventListener('keydown', (event) => this.onDocumentKeyDown(event), false);
  }

  createControlPanel() {
    const cntlPanel = this.gui.addFolder('Video Panel');
    cntlPanel.add({ play: () => this.video.play() }, 'play').name('play the video');
    cntlPanel.add({ pause: () => this.video.pause() }, 'pause').name('pause the video');
    cntlPanel.add({ stop: () => { this.video.pause(); this.video.currentTime = 0; } }, 'stop').name('stop the video');

    const bulbPanel = this.gui.addFolder('Bulb Panel');
    bulbPanel.add(this.bulbParams, 'bulbPower', Object.keys(this.bulbLuminousPowers)).onChange((value) => {
      const powerValue = this.bulbLuminousPowers[value];
      this.bulbLight.intensity = powerValue / 800;
    });
    bulbPanel.add(this.bulbParams, 'exposure', 0.1, 5);

    const spotLightPanel = this.gui.addFolder('SpotLight Panel');
    spotLightPanel.addColor(this.spotLightParams, 'color').onChange((val) => this.spotLight.color.setHex(val));
    spotLightPanel.add(this.spotLightParams, 'intensity', 300000, 1000000).onChange((val) => this.spotLight.intensity = val);
    spotLightPanel.add(this.spotLightParams, 'distance', 50, 150).onChange((val) => this.spotLight.distance = val);
    spotLightPanel.add(this.spotLightParams, 'angle', 0, Math.PI / 3).onChange((val) => this.spotLight.angle = val);
    spotLightPanel.add(this.spotLightParams, 'penumbra', 0, 1).onChange((val) => this.spotLight.penumbra = val);
    spotLightPanel.add(this.spotLightParams, 'decay', 1, 2).onChange((val) => this.spotLight.decay = val);
    spotLightPanel.add(this.spotLightParams, 'focus', 0, 1).onChange((val) => this.spotLight.shadow.focus = val);

    const spatialSoundPanel = this.gui.addFolder('Spatial Sound Panel');
    spatialSoundPanel.add(this.audioControls, 'volume', 0, 2, 0.1).name('volume').onChange((value) => this.positionalAudio.setVolume(value));
    spatialSoundPanel.add(this.audioControls, 'pitch', 0.5, 2, 0.1).name('pitch').onChange((value) => this.audioElement.playbackRate = value);
    spatialSoundPanel.add(this.audioControls, 'togglePlay').name('play/stop');

    const folderWater = this.gui.addFolder('Water Panel');
    folderWater.add(this.water.material.uniforms.distortionScale, 'value', 0, 8, 0.1).name('distortionScale');
    folderWater.add(this.water.material.uniforms.size, 'value', 0.1, 10, 0.1).name('size');

    spatialSoundPanel.open();
    cntlPanel.open();
    bulbPanel.open();
    spotLightPanel.open();
    folderWater.open();
  }
  // Classroom
  createFloor() {
    const textureLoader = new THREE.TextureLoader();
    const rgbeLoader = new EXRLoader();

    const colorTexture = textureLoader.load('../../assets/textures/dirty_carpet_diff_4k.jpg');
    const aoTexture = textureLoader.load('../../assets/textures/dirty_carpet_disp_4k.png');
    const normalTexture = rgbeLoader.load('../../assets/textures/dirty_carpet_nor_gl_4k.exr');
    const roughnessTexture = rgbeLoader.load('../../assets/textures/dirty_carpet_rough_4k.exr');

    [colorTexture, aoTexture, normalTexture, roughnessTexture].forEach(texture => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(4, 4);
    });

    const floorMaterial = new THREE.MeshStandardMaterial({
      map: colorTexture,
      aoMap: aoTexture,
      normalMap: normalTexture,
      roughnessMap: roughnessTexture,
      roughness: 1.0,
      metalness: 0.2
    });

    const floorGeometry = new THREE.PlaneGeometry(200, 200, 100, 100);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;

    this.scene.add(floor);
  }

  createTeacherDesk() {
    const podiumGeometry = new THREE.BoxGeometry(40, 2, 20);
    const podiumMaterial = new THREE.MeshStandardMaterial({ color: 0xD3D3D3 });
    const podium = new THREE.Mesh(podiumGeometry, podiumMaterial);
    podium.position.set(0, 0, -60);
    podium.castShadow = true;
    podium.receiveShadow = true;
    this.scene.add(podium);

    const deskGeometry = new THREE.BoxGeometry(30, 4, 15);
    const deskMaterial = this.createCustomDeskMaterial();
    const desk = new THREE.Mesh(deskGeometry, deskMaterial);
    desk.position.set(0, 22, -60);
    desk.castShadow = true;
    desk.receiveShadow = true;
    this.scene.add(desk);

    const legGeometry = new THREE.BoxGeometry(2, 20, 2);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });

    const leg1 = new THREE.Mesh(legGeometry, legMaterial);
    leg1.position.set(-14, 10, -60);
    leg1.castShadow = true;
    this.scene.add(leg1);

    const leg2 = new THREE.Mesh(legGeometry, legMaterial);
    leg2.position.set(14, 10, -60);
    leg2.castShadow = true;
    this.scene.add(leg2);

    return desk;
  }

  createChairs() {
    const chairSeatGeometry = new THREE.BoxGeometry(6, 1, 6);
    const chairBackGeometry = new THREE.BoxGeometry(6, 8, 1);
    const chairMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0xD3D3D3 });

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        const chairGroup = new THREE.Group();

        const seat = new THREE.Mesh(chairSeatGeometry, chairMaterial);
        seat.position.y = 6;
        seat.castShadow = true;
        chairGroup.add(seat);

        const back = new THREE.Mesh(chairBackGeometry, chairMaterial);
        back.position.set(0, 10.5, 3);
        back.castShadow = true;
        chairGroup.add(back);

        const legGeometry = new THREE.BoxGeometry(1, 6, 1);
        for (let i = 0; i < 4; i++) {
          const leg = new THREE.Mesh(legGeometry, legMaterial);
          const xPos = ((i % 2) * 4) - 2;
          const zPos = (Math.floor(i / 2) * 4) - 2;
          leg.position.set(xPos, 3, zPos);
          leg.castShadow = true;
          chairGroup.add(leg);
        }

        chairGroup.position.set((col - 2.5) * 20, 0, row * 20 - 20);
        this.scene.add(chairGroup);
      }
    }
  }

  createDesks() {
    const deskGeometry = new THREE.BoxGeometry(120, 1, 8);
    const deskMaterial = new THREE.MeshStandardMaterial({ color: 0xD3D3D3 });
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });

    for (let row = 0; row < 5; row++) {
      const deskGroup = new THREE.Group();

      const desktop = new THREE.Mesh(deskGeometry, deskMaterial);
      desktop.position.y = 12.5;
      desktop.castShadow = true;
      desktop.receiveShadow = true;
      deskGroup.add(desktop);

      const legRowGeometry = new THREE.BoxGeometry(120, 12, 1);
      const legRow = new THREE.Mesh(legRowGeometry, legMaterial);
      legRow.position.set(0, 6, -4);
      legRow.castShadow = true;
      deskGroup.add(legRow);

      const legColGeometry = new THREE.BoxGeometry(1, 12, 8);
      for (let i = 0; i < 7; i++) {
        const legCol = new THREE.Mesh(legColGeometry, legMaterial);
        const xPos = (i * 20) - 60;
        const zPos = 0;
        legCol.position.set(xPos, 6, zPos);
        legCol.castShadow = true;
        deskGroup.add(legCol);
      }

      deskGroup.position.set(0, 0, row * 20 - 25);
      this.scene.add(deskGroup);
    }
  }

  createFloorToWindowWindow(x, y, z, width, height) {
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xC0C0C0,
      metalness: 0.3,
      roughness: 0.5
    });

    const glassMaterial = this.createCustomGlassMaterial();

    const frameThickness = 1;
    const frameWidth = 1;

    const windowGroup = new THREE.Group();

    const glassGeometry = new THREE.BoxGeometry(1, height, width);
    const glass = new THREE.Mesh(glassGeometry, glassMaterial);
    glass.position.set(0, 0, 0);
    windowGroup.add(glass);

    for (let i = 0; i < 4; i++) {
      const topFrameGeometry = new THREE.BoxGeometry(frameThickness, frameWidth, width);
      const topFrame = new THREE.Mesh(topFrameGeometry, frameMaterial);
      topFrame.position.set(0, (height / 3) * i - (height / 2), 0);
      topFrame.castShadow = true;
      windowGroup.add(topFrame);
    }

    for (let i = 0; i < 7; i++) {
      const leftFrameGeometry = new THREE.BoxGeometry(frameThickness, height, frameWidth);
      const leftFrame = new THREE.Mesh(leftFrameGeometry, frameMaterial);
      leftFrame.position.set(0, 0, (width / 6) * i - (width / 2));
      leftFrame.castShadow = true;
      windowGroup.add(leftFrame);
    }

    windowGroup.position.set(x, y, z);
    windowGroup.rotation.y = Math.PI;

    const clock = new THREE.Clock();
    const updateRain = () => {
      glassMaterial.uniforms.time.value = clock.getElapsedTime() * 0.2;
    };

    return {
      windowGroup,
      glassMaterial,
      updateRain,
      updateRainIntensity: (value) => glassMaterial.uniforms.rainIntensity.value = value,
      updateDistortion: (value) => glassMaterial.uniforms.distortion.value = value
    };
  }

  createDoor(posX, posY, posZ, width, height, depth) {
    const doorGroup = new THREE.Group();

    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xD4AF37,
      roughness: 0.2,
      metalness: 0.8
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      roughness: 0,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });

    const windowFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x5C4033,
      roughness: 0.8,
      metalness: 0.1
    });

    const doorGeometry = new THREE.BoxGeometry(width, height, depth);
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.castShadow = true;
    door.receiveShadow = true;
    doorGroup.add(door);

    const panelDepth = 0.5;
    const panelMargin = 3;
    const panelWidth = width - panelMargin * 2;
    const panelHeight = height - panelMargin * 2;

    const panelGeometry = new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth);
    const panel = new THREE.Mesh(panelGeometry, doorMaterial);
    panel.position.set(0, 0, depth / 2 + panelDepth / 2);
    doorGroup.add(panel);

    const windowWidth = width * 0.2;
    const windowHeight = height * 0.4;
    const windowPosY = height * 0.1;

    const windowFrameWidth = windowWidth + 2;
    const windowFrameHeight = windowHeight + 2;
    const windowFrameDepth = 1;

    const windowFrameGeometry = new THREE.BoxGeometry(windowFrameWidth, windowFrameHeight, windowFrameDepth);
    const windowFrame = new THREE.Mesh(windowFrameGeometry, windowFrameMaterial);
    windowFrame.position.set(0, windowPosY, depth / 2 + windowFrameDepth / 2);
    doorGroup.add(windowFrame);

    const windowGlassGeometry = new THREE.BoxGeometry(windowWidth, windowHeight, 0.2);
    const windowGlass = new THREE.Mesh(windowGlassGeometry, glassMaterial);
    windowGlass.position.set(0, windowPosY, depth / 2 + windowFrameDepth + 0.15);
    doorGroup.add(windowGlass);

    const handleBaseRadius = 2;
    const handleBaseHeight = 1;
    const handleCylinderGeometry = new THREE.CylinderGeometry(handleBaseRadius, handleBaseRadius, handleBaseHeight, 16);
    const handleBase = new THREE.Mesh(handleCylinderGeometry, handleMaterial);
    handleBase.rotation.x = Math.PI / 2;
    handleBase.position.set(width / 4, 0, depth / 2 + handleBaseHeight / 2);
    doorGroup.add(handleBase);

    const handleBarRadius = 0.8;
    const handleBarLength = 5;
    const handleBarGeometry = new THREE.CylinderGeometry(handleBarRadius, handleBarRadius, handleBarLength, 8);
    const handleBar = new THREE.Mesh(handleBarGeometry, handleMaterial);
    handleBar.position.set(width / 4, 0, depth / 2 + handleBaseHeight);
    doorGroup.add(handleBar);

    const handleKnobRadius = 0.3;
    const handleKnobLength = 4;
    const handleKnobGeometry = new THREE.CylinderGeometry(handleKnobRadius, handleKnobRadius, handleKnobLength, 8);
    const handleKnob = new THREE.Mesh(handleKnobGeometry, handleMaterial);
    handleKnob.position.set(width / 3, 0, depth / 2 + handleBaseHeight * 2);
    handleKnob.rotation.z = Math.PI / 2;
    doorGroup.add(handleKnob);

    const lockRadius = 1.5;
    const lockDepth = 0.5;
    const lockGeometry = new THREE.CylinderGeometry(lockRadius, lockRadius, lockDepth, 16);
    const lock = new THREE.Mesh(lockGeometry, handleMaterial);
    lock.rotation.x = Math.PI / 2;
    lock.position.set(width / 4, -height / 8, depth / 2 + lockDepth);
    doorGroup.add(lock);

    doorGroup.position.set(posX, posY, posZ);

    return doorGroup;
  }

  createWalls() {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });

    const backWallGeometry = new THREE.PlaneGeometry(200, 80);
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.set(0, 40, -100);
    backWall.receiveShadow = true;
    this.scene.add(backWall);
    const door = this.createDoor(80, 27.5, -99, 30, 55, 1);
    this.scene.add(door);

    const { windowGroup, updateRain } = this.createFloorToWindowWindow(-100, 40, 0, 200, 80);
    this.scene.add(windowGroup);
    this.windowRainUpdate = updateRain;

    const sideWall2Geometry = new THREE.PlaneGeometry(200, 80);
    const sideWall2 = new THREE.Mesh(sideWall2Geometry, wallMaterial);
    sideWall2.position.set(100, 40, 0);
    sideWall2.rotation.y = -Math.PI / 2;
    sideWall2.receiveShadow = true;
    this.scene.add(sideWall2);

    const ceilingGeometry = new THREE.PlaneGeometry(200, 200);
    const ceiling = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    const ceilingMesh = new THREE.Mesh(ceilingGeometry, ceiling);
    ceilingMesh.position.set(0, 80, 0);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.receiveShadow = true;
    this.scene.add(ceilingMesh);
  }

  createWallClock(x, y, z, radius) {
    const clockGroup = new THREE.Group();

    const faceMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.2,
      metalness: 0.1
    });

    const frameMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.3,
      metalness: 0.7
    });

    const handMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.1,
      metalness: 0.2
    });

    const secondHandMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF0000,
      roughness: 0.1,
      metalness: 0.2
    });

    const faceGeometry = new THREE.CircleGeometry(radius, 32);
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    face.receiveShadow = true;
    clockGroup.add(face);

    const frameGeometry = new THREE.RingGeometry(radius, radius + 1, 32);
    const frame = new THREE.Mesh(frameGeometry, frameMetalMaterial);
    frame.position.z = 0.1;
    frame.castShadow = true;
    clockGroup.add(frame);

    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI / 6);
      const markerLength = (i % 3 === 0) ? 2 : 1;
      const markerWidth = (i % 3 === 0) ? 0.8 : 0.5;

      const markerGeometry = new THREE.BoxGeometry(markerWidth, markerLength, 0.2);
      const marker = new THREE.Mesh(markerGeometry, handMaterial);

      const markerDistance = radius - markerLength / 2 - 1;
      marker.position.set(
        Math.sin(angle) * markerDistance,
        Math.cos(angle) * markerDistance,
        0.2
      );
      marker.rotation.z = -angle;
      clockGroup.add(marker);

      if (i % 3 === 0) {
        const numberDistance = radius - 4;
        const numbers = ["12", "3", "6", "9"];
        const number = this.createTextMesh(numbers[i / 3], 0x000000, 2);
        number.position.set(
          Math.sin(angle) * numberDistance,
          Math.cos(angle) * numberDistance,
          0.2
        );
        clockGroup.add(number);
      }
    }

    const hourHandGroup = new THREE.Group();
    const minuteHandGroup = new THREE.Group();
    const secondHandGroup = new THREE.Group();

    clockGroup.add(hourHandGroup);
    clockGroup.add(minuteHandGroup);
    clockGroup.add(secondHandGroup);

    const hourHandGeometry = new THREE.BoxGeometry(1, radius * 0.5, 0.3);
    hourHandGeometry.translate(0, radius * 0.25, 0);
    const hourHand = new THREE.Mesh(hourHandGeometry, handMaterial);
    hourHand.position.z = 0.4;
    hourHand.castShadow = true;
    hourHandGroup.add(hourHand);

    const minuteHandGeometry = new THREE.BoxGeometry(0.6, radius * 0.7, 0.2);
    minuteHandGeometry.translate(0, radius * 0.35, 0);
    const minuteHand = new THREE.Mesh(minuteHandGeometry, handMaterial);
    minuteHand.position.z = 0.5;
    minuteHand.castShadow = true;
    minuteHandGroup.add(minuteHand);

    const secondHandGeometry = new THREE.BoxGeometry(0.2, radius * 0.8, 0.1);
    secondHandGeometry.translate(0, radius * 0.4, 0);
    const secondHand = new THREE.Mesh(secondHandGeometry, secondHandMaterial);
    secondHand.position.z = 0.6;
    secondHand.castShadow = true;
    secondHandGroup.add(secondHand);

    const pinGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.8, 16);
    const pin = new THREE.Mesh(pinGeometry, frameMetalMaterial);
    pin.rotation.x = Math.PI / 2;
    pin.position.z = 0.7;
    clockGroup.add(pin);

    clockGroup.position.set(x, y, z);

    clockGroup.userData = {
      hourHandGroup,
      minuteHandGroup,
      secondHandGroup,
      updateTime: function () {
        const now = new Date();
        const hours = now.getHours() % 12;
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        this.hourHandGroup.rotation.z = -((hours + minutes / 60) * Math.PI / 6);
        this.minuteHandGroup.rotation.z = -(minutes * Math.PI / 30);
        this.secondHandGroup.rotation.z = -(seconds * Math.PI / 30);
      }
    };

    return clockGroup;
  }

  createTextMesh(text, color, size) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;

    context.font = '48px Arial';
    context.fillStyle = 'black';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(size, size, 1);

    return sprite;
  }

  initWithClock() {
    const clock = this.createWallClock(-70, 50, -99, 8);
    this.scene.add(clock);
    this.clockObject = clock;
  }

  createSphere() {
    const wavyMaterial = this.createCustomWavyMaterial();
    const geometry = new THREE.SphereGeometry(5, 128, 128);
    this.sphere = new THREE.Mesh(geometry, wavyMaterial);
    this.sphere.position.set(80, 20, 15);
    this.scene.add(this.sphere);
  }
  // projection
  createProjectionScreen() {
    const screenWidth = 80;
    const screenHeight = 45;
    const frameThickness = 0.5;

    const screenGroup = new THREE.Group();

    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.1,
      metalness: 0
    });

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xC0C0C0,
      roughness: 0.5,
      metalness: 0.2
    });

    const screenGeometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.receiveShadow = true;
    screenGroup.add(screen);

    const topFrameGeometry = new THREE.BoxGeometry(screenWidth + frameThickness * 2, frameThickness, 1);
    const topFrame = new THREE.Mesh(topFrameGeometry, frameMaterial);
    topFrame.position.set(0, screenHeight / 2 + frameThickness / 2, 0);
    screenGroup.add(topFrame);

    const bottomFrameGeometry = new THREE.BoxGeometry(screenWidth + frameThickness * 2, frameThickness, 1);
    const bottomFrame = new THREE.Mesh(bottomFrameGeometry, frameMaterial);
    bottomFrame.position.set(0, -screenHeight / 2 - frameThickness / 2, 0);
    screenGroup.add(bottomFrame);

    const leftFrameGeometry = new THREE.BoxGeometry(frameThickness, screenHeight + frameThickness * 2, 1);
    const leftFrame = new THREE.Mesh(leftFrameGeometry, frameMaterial);
    leftFrame.position.set(-screenWidth / 2 - frameThickness / 2, 0, 0);
    screenGroup.add(leftFrame);

    const rightFrameGeometry = new THREE.BoxGeometry(frameThickness, screenHeight + frameThickness * 2, 1);
    const rightFrame = new THREE.Mesh(rightFrameGeometry, frameMaterial);
    rightFrame.position.set(screenWidth / 2 + frameThickness / 2, 0, 0);
    screenGroup.add(rightFrame);

    const canvasTexture = this.createCanvasTexture();
    screen.material = new THREE.MeshBasicMaterial({ map: canvasTexture });

    screenGroup.position.set(0, 35, -98);
    this.scene.add(screenGroup);

    return screenGroup;
  }

  createVideoProjection() {
    const screen = this.createProjectorScreen();
    this.videoTexture = new THREE.VideoTexture(this.video);
    this.videoTexture.generateMipmaps = false;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.format = THREE.RGBAFormat;
    screen.material = new THREE.MeshBasicMaterial({ map: this.videoTexture });
  }

  createProjectorScreen() {
    const screenGeometry = new THREE.PlaneGeometry(50, 28);
    const screenMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, 35, -95);
    this.scene.add(screen);
    return screen;
  }

  createProjector() {
    const projectorGroup = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(8, 4, 10);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    projectorGroup.add(body);

    const lensGeometry = new THREE.CylinderGeometry(2, 2, 2, 16);
    const lensMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 6);
    lens.castShadow = true;
    projectorGroup.add(lens);

    projectorGroup.position.set(0, 50, -20);
    projectorGroup.rotation.x = Math.PI * 11 / 12;
    this.scene.add(projectorGroup);
  }

  createCanvasTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 576;

    const context = canvas.getContext('2d');
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000000';
    context.font = '48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('Canvas', canvas.width / 2, canvas.height / 2);
    context.strokeStyle = '#333333';
    context.lineWidth = 8;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
  // light
  createLight() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
    mainLight.position.set(-120, 60, 30);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 500;
    mainLight.shadow.camera.left = -100;
    mainLight.shadow.camera.right = 100;
    mainLight.shadow.camera.top = 100;
    mainLight.shadow.camera.bottom = -100;
    this.scene.add(mainLight);

    const projectorLight = new THREE.SpotLight(0xFFFACD, 1);
    projectorLight.position.set(0, 50, -20);
    projectorLight.target.position.set(0, 35, -95);
    projectorLight.angle = 0.3;
    projectorLight.penumbra = 0.2;
    projectorLight.distance = 100;
    projectorLight.castShadow = false;
    this.scene.add(projectorLight);
    this.scene.add(projectorLight.target);
  }

  createBulb() {
    const bulbGeometry = new THREE.SphereGeometry(1, 32, 32);
    this.bulbLight = new THREE.PointLight(0xffee88, 1, 100, 2);
    this.bulbMat = new THREE.MeshStandardMaterial({
      emissive: 0xffffee,
      emissiveIntensity: 1,
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.1
    });
    this.bulbLight.add(new THREE.Mesh(bulbGeometry, this.bulbMat));
    this.bulbLight.position.set(0, 2, 0);
    this.bulbLight.castShadow = true;
    this.scene.add(this.bulbLight);
  }

  createCeilingLights() {
    const lightWidth = 180;
    const lightLength = 15;
    const lightIntensity = 3;
    const lightColor = 0xFFFACD;

    const lightMaterial = new THREE.MeshStandardMaterial({
      color: lightColor,
      side: THREE.DoubleSide,
      emissive: lightColor,
      emissiveIntensity: 3,
      roughness: 0.1,
      metalness: 0.0
    });

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xAAAAAA,
      roughness: 0.5,
      metalness: 0.2
    });

    for (let i = 0; i < 3; i++) {
      const lightGroup = new THREE.Group();

      const lightGeometry = new THREE.PlaneGeometry(lightWidth - 10, lightLength - 5);
      const lightMesh = new THREE.Mesh(lightGeometry, lightMaterial);
      lightMesh.rotation.x = Math.PI / 2;
      lightMesh.position.y = -1.5;
      lightMesh.castShadow = false;
      lightGroup.add(lightMesh);

      const frameGeometry = new THREE.BoxGeometry(lightWidth + 2, 1, lightLength + 2);
      const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
      frameMesh.position.y = -0.2;
      frameMesh.castShadow = false;
      lightGroup.add(frameMesh);

      const rectLight = new THREE.RectAreaLight(lightColor, lightIntensity, lightWidth, lightLength);
      rectLight.position.y = -1;
      rectLight.rotation.x = -Math.PI / 2;
      lightGroup.add(rectLight);

      const zOffset = (i === 1) ? 0 : (i === 0 ? -60 : 60);
      lightGroup.position.set(0, 79, zOffset);
      this.scene.add(lightGroup);
    }
  }

  createSpotLight() {
    this.spotLight = new THREE.SpotLight(0x17eded, 300000);
    this.spotLight.position.set(0, 60, -45);
    this.spotLight.angle = Math.PI / 6;
    this.spotLight.penumbra = 1;
    this.spotLight.decay = 2;
    this.spotLight.distance = 100;
    this.spotLight.target.position.set(0, 0, -45);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.width = 1024;
    this.spotLight.shadow.mapSize.height = 1024;
    this.spotLight.shadow.camera.near = 1;
    this.spotLight.shadow.camera.far = 50;
    this.spotLight.shadow.focus = 1;
    this.spotLightParams = {
      color: this.spotLight.color.getHex(),
      intensity: this.spotLight.intensity,
      distance: this.spotLight.distance,
      angle: this.spotLight.angle,
      penumbra: this.spotLight.penumbra,
      decay: this.spotLight.decay,
      focus: this.spotLight.shadow.focus,
      shadows: true
    };
    this.scene.add(this.spotLight);
    this.scene.add(this.spotLight.target);
    this.lightHelper = new THREE.SpotLightHelper(this.spotLight);
    this.scene.add(this.lightHelper);
  }
  // key event
  onDocumentKeyDown(event) {
    const keyCode = event.which;
    if (keyCode === 32) { // space
      this.video.play();
      console.log("play");
    } else if (keyCode === 80) { // P key
      this.video.pause();
      console.log("pause");
    } else if (keyCode === 83) { // S key
      this.video.pause();
      this.video.currentTime = 0;
      console.log("stop");
    } else if (keyCode === 82) { // R key
      this.video.currentTime = 0;
      this.stats.update();
      console.log("reset");
    }
  }
  // audio
  setupSpatialSound() {
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    this.audioElement = new Audio(this.soundFile);
    this.audioElement.loop = false;
    this.audioElement.crossOrigin = "anonymous";

    this.positionalAudio = new THREE.PositionalAudio(this.listener);
    this.positionalAudio.setMediaElementSource(this.audioElement);
    this.positionalAudio.setRefDistance(5);
    this.positionalAudio.setMaxDistance(50);
    this.positionalAudio.setDirectionalCone(180, 230, 0.1);
    this.positionalAudio.setVolume(1.0);

    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(6, 6, 6),
      this.createCustomGlowMaterial()
    );
    this.mesh.position.set(0, 20, 15);
    this.mesh.add(this.positionalAudio);
    this.scene.add(this.mesh);
  }

  toggleAudioPlay() {
    if (this.listener.context.state === "suspended") {
      this.listener.context.resume().then(() => console.log("AudioContext resumed!"));
    }
    if (this.audioControls.isPlaying) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    } else {
      this.audioElement.play();
    }
    this.audioControls.isPlaying = !this.audioControls.isPlaying;
  }
  // shader
  createCustomGlassMaterial() {
    const vertexShader = `
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      
      void main() {
        vPosition = position;
        vNormal = normal;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 color;
      uniform float opacity;
      uniform float time;
      uniform float rainIntensity;
      uniform float rainSize;
      uniform float distortion;
      
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      
      float rainDrop(vec2 uv, float time) {
        vec2 scaledUV = uv * vec2(10.0, 20.0);
        float timeScale = time * 3.5;
        scaledUV.y += timeScale;
        float noise1 = noise(scaledUV * 1.0);
        float noise2 = noise(scaledUV * 2.0 + 0.5);
        float rainPattern = smoothstep(0.35, 0.65, noise1 * noise2);
        float flowEffect = smoothstep(0.4, 0.6, fract(uv.y * 20.0 + time));
        
        return mix(rainPattern, flowEffect, 0.5);
      }
      
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        float fresnel = 0.1 + 1.0 * pow(1.0 + dot(viewDirection, vNormal), 2.0);
        float rainEffect = rainDrop(vUv, time);
        vec2 distortedUV = vUv;
        distortedUV += (rainEffect * 2.0 - 1.0) * distortion;
        float rainDropOpacity = rainEffect * rainIntensity;
        float finalOpacity = opacity * (1.0 - fresnel * 0.5) + rainDropOpacity * 0.3;
        vec3 finalColor = color + vec3(0.1, 0.1, 0.2) * rainEffect;
        
        gl_FragColor = vec4(finalColor, finalOpacity);
      }
    `;

    const customMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xaaddff) },
        opacity: { value: 0.5 },
        time: { value: 0.0 },
        rainIntensity: { value: 0.8 },
        rainSize: { value: 0.5 },
        distortion: { value: 0.05 }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });

    return customMaterial;
  }

  createCustomDeskMaterial() {
    const vertexShader = `
      varying vec2 vUv;
      uniform float time;

      void main() {
        vUv = uv;
        vec3 pos = position;
          
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;
    const fragmentShader = `
      uniform float time;
      varying vec2 vUv;
      uniform vec3 color1;
      uniform vec3 color2;
      uniform vec3 color3;

      vec3 smoothColorTransition(vec3 a, vec3 b, vec3 c, float t) {
        float smoothT = t * 2.0;
        
        if (smoothT < 1.0) {
          return mix(a, b, smoothT);
        } else {
          return mix(b, c, smoothT - 1.0);
        }
      }

      void main() {
        float flowTime = time * 0.6;
        float colorFlow = sin(vUv.x * 1.5 + flowTime) * 0.5 + 0.5;
        vec3 finalColor = smoothColorTransition(color1, color2, color3, colorFlow);
        float brightness = 0.9 + 0.1 * sin(time * 0.4);
        finalColor *= brightness;
        float distortion = sin(time * 0.2 + vUv.y * 3.0) * 0.03;
        finalColor += distortion;
          
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
    const customMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        color1: { value: new THREE.Color(0x00ffcc) },
        color2: { value: new THREE.Color(0x00aaff) },
        color3: { value: new THREE.Color(0x1a3b5d) }
      },
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide
    });

    return customMaterial;
  }

  createCustomWavyMaterial() {
    const vertexShader = `
      uniform float uTime;
      uniform float uSpeed;
      uniform float uFrequency;
      uniform float uAmplitude;
      
      varying vec2 vUv;
      varying float vWave;

      void main() {
        vUv = uv;
        float wave = sin(position.x * uFrequency + uTime * uSpeed) * uAmplitude;
        vec3 newPosition = position + normal * wave;
        vWave = wave;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `;
    const fragmentShader = `
      uniform vec3 uColor;
      varying float vWave;

      void main() {
        vec3 finalColor = uColor + vec3(vWave * 0.3);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
    const customMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xFFEFF5) },
        uTime: { value: 0.0 },
        uSpeed: { value: 2.0 },
        uFrequency: { value: 5.0 },
        uAmplitude: { value: 0.2 }
      },
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide
    });
    return customMaterial;
  }

  createCustomGlowMaterial() {
    const vertexShader = `
      varying vec3 vertexNormal;
              
      void main() {
        vertexNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const fragmentShader = `
      uniform vec3 glowColor;
      uniform float intensity;
      varying vec3 vertexNormal;
      
      void main() {
        float opacity = pow(abs(dot(vertexNormal, vec3(0.0, 0.0, 1.0))), intensity);
        gl_FragColor = vec4(glowColor, opacity);
      }
    `;
    const customMaterial = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0x00ffff) },
        intensity: { value: 1.5 }
      },
      vertexShader,
      fragmentShader,
      transparent: true
    });
    return customMaterial;
  }

  createWater() {
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    this.water = new Water(
      waterGeometry,
      {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load('../../assets/textures/waternormals.jpg', (texture) => {
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        }),
        sunDirection: new THREE.Vector3(),
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: this.scene.fog !== undefined
      }
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -5;
    this.scene.add(this.water);
  }

  updateDeskMaterialAnimation(desk, deltaTime) {
    if (desk.material && desk.material.uniforms) {
      desk.material.uniforms.time.value += deltaTime;
      desk.material.needsUpdate = true;
    }
  }
  // character
  loadCharacter(modelPath, size = { x, y, z }, position = { x, y, z }) {
    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(size.x, size.y, size.z);
        model.position.set(position.x, position.y, position.z);
        model.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) node.material.needsUpdate = true;
          }
        });
        this.scene.add(model);

        if (gltf.animations && gltf.animations.length) {
          const mixer = new THREE.AnimationMixer(model);
          this.mixers.push(mixer);
          const animation = gltf.animations[0];
          const action = mixer.clipAction(animation);
          action.play();
        }
      }
    );
  }
  // XR
  createXR() {
    this.userRig = new THREE.Group();
    this.userRig.position.set(0, 25, 100);
    this.scene.add(this.userRig);
    this.renderer.xr.enabled = true;
    document.body.appendChild(VRButton.createButton(this.renderer));
    const controllerModelFactory = new XRControllerModelFactory();

    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ]);
    const material = new THREE.LineBasicMaterial({color: 0xff0000});
    this.controllers = [];
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);

      const line = new THREE.Line(geometry, material);
      line.scale.z = 0;
      controller.add(line);

      controller.userData.selectPressed = false;

      controller.addEventListener('selectstart', () => {
        controller.children[0].scale.z = 10;
        controller.userData.selectPressed = true;
      });
      controller.addEventListener('selectend', () => {
        controller.children[0].scale.z = 0;
        controller.userData.selectPressed = false;

        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.extractRotation(controller.matrixWorld);
        const raycaster = new THREE.Raycaster();
        raycaster.camera = this.camera;
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotationMatrix);
        
        const intersects = raycaster.intersectObjects([this.playButton]);
        if (intersects.length > 0) {
          this.playButton.material.color.setHex(0x00ff00);
        }
      });
      this.userRig.add(controller);
      this.controllers.push(controller);

      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(controllerModelFactory.createControllerModel(grip));
      this.userRig.add(grip);
    }

    this.createVRPlayButton();

    this.renderer.xr.addEventListener('sessionstart', () => {
      this.controls.enabled = false;
      this.userRig.add(this.camera);
      for (let i = 0; i < this.controllers.length; i++) {
        this.userRig.add(this.controllers[i]);
      }
    });
    this.renderer.xr.addEventListener("sessionend", () => {
      this.controls.enabled = true;
      this.userRig.remove(this.camera);
      this.scene.add(this.camera);
      for (let i = 0; i < this.controllers.length; i++) {
        this.userRig.remove(this.controllers[i]);
        this.scene.add(this.controllers[i]);
      }
    });
  }

  handleController(controller) {
    if (controller.userData.selectPressed) {
      const rotationMatrix = new THREE.Matrix4();
      rotationMatrix.extractRotation(controller.matrixWorld);
      const raycaster = new THREE.Raycaster();
      raycaster.camera = this.camera;
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotationMatrix);
      const intersects = raycaster.intersectObjects([this.playButton]);
      if (intersects.length > 0) {
        if (controller.userData.selectPressed) {
          this.video.play();
          this.playButton.material.color.setHex(0xff0000); 
        } else {
          this.playButton.material.color.setHex(0x00ff00); 
        }
      } else {
        const sceneIntersects = raycaster.intersectObjects(this.scene.children, true);
        if (sceneIntersects.length > 0) {
          controller.children[0].scale.z = sceneIntersects[0].distance;
        }
      }
    }
  }

  createVRPlayButton() {
    const buttonGeometry = new THREE.BoxGeometry(5, 2, 1);
    const buttonMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00ff00,
        emissive: 0x002200,
        roughness: 0.5,
        metalness: 0.2
    });
    
    this.playButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
    this.playButton.position.set(0, 27, 90);
    this.playButton.userData = { clickable: true }; 
    this.scene.add(this.playButton);
  }
  // Physics 
  physics(){
    this.world = new CANNON.World({gravity: new CANNON.Vec3(0, -9.81, 0)});
    this.world.solver.iterations = 20;
    const planeBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(100, 0.001, 100))
    });
    planeBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(planeBody)

    // Materials for cloth and sphere interaction
    const clothMaterial = new CANNON.Material('cloth');
    const sphereMaterial = new CANNON.Material('sphere');
    const cloth_sphere = new CANNON.ContactMaterial(clothMaterial, sphereMaterial, {
        friction: 0,
        restitution: 0,
        contactEquationStiffness: 1e9,
        contactEquationRelaxation: 3
    });
    this.world.addContactMaterial(cloth_sphere);

    // Create sphere body
    const sphereShape = new CANNON.Sphere(this.sphereSize * 1.3);
    this.sphereBody = new CANNON.Body({
        type: CANNON.Body.KINEMATIC,
    });
    this.sphereBody.addShape(sphereShape);
    this.world.addBody(this.sphereBody);
  }

  initCloth() {
    // Cloth material
    const clothTexture = new THREE.TextureLoader().load('../../assets/textures/sunflower.jpg');
    clothTexture.wrapS = THREE.RepeatWrapping;
    clothTexture.wrapT = THREE.RepeatWrapping;
    clothTexture.anisotropy = 16;
    clothTexture.encoding = THREE.sRGBEncoding;

    const clothMaterial = new THREE.MeshPhongMaterial({
        map: clothTexture,
        side: THREE.DoubleSide,
    });

    // Cloth geometry
    this.clothGeometry = new THREE.PlaneGeometry(
      this.clothSize,
      this.clothSize,
      this.Nx,
      this.Ny
    );

    // Cloth mesh
    this.clothMesh = new THREE.Mesh(this.clothGeometry, clothMaterial);
    this.clothMesh.position.set(-80, 40, 0); 
    this.clothMesh.rotation.y = -Math.PI / 2;
    this.clothMesh.castShadow = true;
    this.clothMesh.receiveShadow = true;
    this.scene.add(this.clothMesh);
    
    // Sphere mesh
    const sphereGeometry = new THREE.SphereGeometry(this.sphereSize, 20, 20);
    const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
    this.sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    this.scene.add(this.sphereMesh);

    // Cannon.js cloth particles
    for (let i = 0; i < this.Nx + 1; i++) {
      this.particles.push([]);
      for (let j = 0; j < this.Ny + 1; j++) {
        const x = (i / this.Nx - 0.5) * this.clothSize;  // Local x (becomes z in world space)
        const y = (j / this.Ny) * this.clothSize;       // Local y (remains y in world space)
        const particle = new CANNON.Body({
          mass: j === this.Ny ? 0 : this.mass, // Fix top row
        });
        particle.addShape(new CANNON.Particle());
        particle.linearDamping = 0.5;
        // Apply position with rotation in mind (y-rotation of -Math.PI/2)
        particle.position.set(
          this.clothMesh.position.x, 
          this.clothMesh.position.y - this.Ny * 0.9 * this.restDistance + y, 
          this.clothMesh.position.z + x  
        );
        particle.velocity.set(0, 0, -0.1 * (this.Ny - j));
        this.particles[i].push(particle);
        this.world.addBody(particle);
      }
    }
    // Connect particles with distance constraints
    for (let i = 0; i < this.Nx + 1; i++) {
      for (let j = 0; j < this.Ny + 1; j++) {
        if (i < this.Nx) {
          this.world.addConstraint(
            new CANNON.DistanceConstraint(
              this.particles[i][j],
              this.particles[i + 1][j],
              this.restDistance
            )
          );
        }
        if (j < this.Ny) {
          this.world.addConstraint(
            new CANNON.DistanceConstraint(
              this.particles[i][j],
              this.particles[i][j + 1],
              this.restDistance
            )
          );
        }
      }
    }
  }

  animate() {
    this.stats.begin();

    this.renderer.toneMappingExposure = Math.pow(this.bulbParams.exposure, 2.0);
    this.bulbLight.power = this.bulbLuminousPowers[this.bulbParams.bulbPower] * 50;
    this.bulbMat.emissiveIntensity = this.bulbLight.power / 100;
    const time = Date.now() * 0.0005;
    this.bulbLight.position.y = Math.cos(time) * 6 + 40;

    this.spotLight.position.x = Math.cos(time) * 5;
    this.spotLight.position.y = 60 + Math.sin(time) * 2;
    this.spotLight.position.z = -45 + Math.sin(time) * 5;
    this.spotLight.target.position.x = Math.sin(time) * 45;
    this.lightHelper.update();

    this.mesh.rotation.x += 0.005;
    this.mesh.rotation.y += 0.01;
    this.sphere.material.uniforms.uTime.value += 0.05;

    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      if (this.videoTexture) this.videoTexture.needsUpdate = true;
    }
    if (this.windowRainUpdate) this.windowRainUpdate();

    const delta = this.clock.getDelta();
    this.mixers.forEach((mixer) => mixer.update(delta));
    if (this.desk) this.updateDeskMaterialAnimation(this.desk, 0.1);
    this.water.material.uniforms['time'].value += 1.0 / 60.0;

    if (this.clockObject) this.clockObject.userData.updateTime();

    this.controllers.forEach((controller) => this.handleController(controller));

    // Update physics
    this.world.fixedStep();

    // Update cloth geometry using attributes.position
    const positions = this.clothGeometry.attributes.position.array;
    for (let i = 0; i < this.Nx + 1; i++) {
      for (let j = 0; j < this.Ny + 1; j++) {
        const index = (j * (this.Nx + 1) + i) * 3; // Each vertex has 3 components (x, y, z)
        // Adjust for cloth's position and rotation (y = -Math.PI/2)
        positions[index] = this.particles[i][j].position.z - this.clothMesh.position.z;     // Local x (world z)
        positions[index + 1] = this.particles[i][j].position.y - this.clothMesh.position.y; // Local y (world y)
        positions[index + 2] = -(this.particles[i][j].position.x - this.clothMesh.position.x); // Local z (negative world x due to rotation)
      }
    }
    this.clothGeometry.attributes.position.needsUpdate = true;
    this.clothGeometry.computeVertexNormals(); // Update normals for lighting

    // Update sphere position
    this.sphereBody.position.set(
      -80 + this.movementRadius * Math.sin(this.world.time),  
      20, 
      this.movementRadius * Math.cos(this.world.time) 
    );
    this.sphereMesh.position.copy(this.sphereBody.position);
    
    this.renderer.render(this.scene, this.camera);
    this.stats.end();
  }

  onWindowResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }
}

window.addEventListener('DOMContentLoaded', () => new App());