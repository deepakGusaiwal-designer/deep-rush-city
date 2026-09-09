import * as THREE from 'three';
import { DayNightMode } from '../types/game';

const SKY_VERT = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;

  void main() {
    vWorldPosition = position;
    vViewDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunsetTint;
  uniform vec3 uMoonColor;
  uniform float uSunIntensity;
  uniform float uMoonIntensity;
  uniform float uStarsAlpha;
  uniform float uTime;
  uniform float uCloudCoverage;
  uniform float uCloudTime;
  uniform float uDarkness;

  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;

  // Pseudo-random hash for stars
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  // 2D simplex-style noise for volumetric-look clouds
  float hash2d(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise2d(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash2d(i);
    float b = hash2d(i + vec2(1.0, 0.0));
    float c = hash2d(i + vec2(0.0, 1.0));
    float d = hash2d(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * noise2d(p);
      p = rot * p * 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 viewDir = normalize(vWorldPosition);
    float height = clamp(viewDir.y, 0.0, 1.0);

    // 1. Atmospheric Horizon-to-Zenith Gradient
    float hExp = pow(1.0 - height, 2.6);
    vec3 skyBase = mix(uZenithColor, uHorizonColor, hExp);

    // Sunset horizon glow along the sunset azimuth
    float cosSun = dot(viewDir, uSunDirection);
    float sunsetCorona = pow(max(0.0, cosSun), 3.0) * pow(1.0 - height, 3.2);
    skyBase += uSunsetTint * sunsetCorona * 1.25;

    // 2. Realistic Sun with Atmospheric Corona
    float sunDisc = smoothstep(0.9991, 0.9997, cosSun);
    float sunGlow = pow(max(0.0, cosSun), 48.0) * 0.75 + pow(max(0.0, cosSun), 10.0) * 0.28;
    vec3 sunLightColor = (uSunColor * sunDisc * 3.5 + uSunColor * sunGlow * 1.1) * uSunIntensity;

    // 3. Realistic Moon with Subtle Craters & Halo
    float cosMoon = dot(viewDir, uMoonDirection);
    float moonDisc = smoothstep(0.9990, 0.9996, cosMoon);
    float craterNoise = 0.85 + 0.15 * sin(viewDir.x * 140.0) * cos(viewDir.z * 140.0);
    float moonGlow = pow(max(0.0, cosMoon), 40.0) * 0.45;
    vec3 moonLightColor = (uMoonColor * moonDisc * craterNoise * 2.2 + uMoonColor * moonGlow * 0.65) * uMoonIntensity;

    // 4. Procedural Twinkling Stars
    vec3 starsColor = vec3(0.0);
    if (uStarsAlpha > 0.01 && height > 0.03) {
      vec3 starCoord = floor(viewDir * 230.0);
      float starRnd = hash(starCoord);
      if (starRnd > 0.986) {
        float twinkle = 0.65 + 0.35 * sin(uTime * 3.2 + starRnd * 45.0);
        float starIntensity = pow((starRnd - 0.986) / 0.014, 2.0) * twinkle;
        vec3 starTint = mix(vec3(0.9, 0.95, 1.0), vec3(1.0, 0.85, 0.7), fract(starRnd * 7.0));
        starsColor = starTint * starIntensity * uStarsAlpha * smoothstep(0.03, 0.22, height);
      }
    }

    // 5. Soft Detailed Moving Clouds
    vec3 cloudResult = vec3(0.0);
    float cloudAlpha = 0.0;
    if (height > 0.02) {
      vec2 cloudPlaneUV = (viewDir.xz / (height + 0.22)) * 0.26;
      vec2 wind1 = vec2(uCloudTime * 0.018, uCloudTime * 0.010);
      vec2 wind2 = vec2(-uCloudTime * 0.012, uCloudTime * 0.022);

      float n1 = fbm(cloudPlaneUV + wind1);
      float n2 = fbm(cloudPlaneUV * 1.8 + wind2);
      float combinedNoise = n1 * 0.65 + n2 * 0.35;

      float cloudDensity = smoothstep(0.42, 0.76, combinedNoise * uCloudCoverage);
      cloudAlpha = cloudDensity * smoothstep(0.02, 0.18, height);

      // Dynamic Cloud Lighting:
      // Day = bright white tops, soft blue shaded bottoms
      // Sunset = brilliant golden-orange underglow catching cloud base
      // Night = dark charcoal/indigo silhouettes illuminated softly by moon
      vec3 dayCloud = mix(vec3(0.68, 0.78, 0.88), vec3(1.0, 1.0, 1.0), n2);
      vec3 sunsetCloud = mix(vec3(0.45, 0.15, 0.2), vec3(1.0, 0.55, 0.22), n1 * 1.2);
      vec3 nightCloud = mix(vec3(0.04, 0.08, 0.16), vec3(0.18, 0.24, 0.38), n2);

      vec3 cloudLit = mix(dayCloud, sunsetCloud, clamp(uSunsetTint.r * 1.4, 0.0, 1.0));
      cloudLit = mix(cloudLit, nightCloud, uDarkness);

      // Cloud rim highlight from sun/moon
      float cloudSunRim = pow(max(0.0, cosSun), 8.0) * (1.0 - uDarkness) * 0.6;
      float cloudMoonRim = pow(max(0.0, cosMoon), 8.0) * uDarkness * 0.35;
      cloudLit += uSunColor * cloudSunRim + uMoonColor * cloudMoonRim;

      cloudResult = cloudLit;
    }

    // Composite Sky + Sun + Moon + Stars + Clouds
    vec3 finalSky = skyBase + sunLightColor + moonLightColor + starsColor;
    vec3 composite = mix(finalSky, cloudResult, cloudAlpha * 0.88);

    gl_FragColor = vec4(composite, 1.0);
  }
`;

export class DynamicSky {
  public scene: THREE.Scene;
  private skyMesh: THREE.Mesh;
  private skyMaterial: THREE.ShaderMaterial;

  // Celestial cycle parameters
  public timeOfDay: number = 0.5; // 0.0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 1.0 = midnight
  public targetTimeOfDay: number = 0.5;
  public isAutoCycle: boolean = false;
  public cycleDurationSeconds: number = 480; // 8 minutes for full 24h day-night cycle

  // Celestial vectors
  public sunDirection: THREE.Vector3 = new THREE.Vector3();
  public moonDirection: THREE.Vector3 = new THREE.Vector3();

  // Dynamic colors for lighting coordination
  public currentHorizonColor: THREE.Color = new THREE.Color();
  public currentZenithColor: THREE.Color = new THREE.Color();
  public currentSunColor: THREE.Color = new THREE.Color();
  public currentMoonColor: THREE.Color = new THREE.Color();
  public currentFogColor: THREE.Color = new THREE.Color();
  public darknessFactor: number = 0.0; // 0.0 (day) to 1.0 (night)

  // Cloud animation
  private cloudTime: number = 0;
  private totalTime: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const skyGeo = new THREE.SphereGeometry(460, 32, 24);

    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
        uMoonDirection: { value: new THREE.Vector3(0, -1, 0) },
        uZenithColor: { value: new THREE.Color(0x1e6bb8) },
        uHorizonColor: { value: new THREE.Color(0x9bd0f5) },
        uSunColor: { value: new THREE.Color(0xfffaed) },
        uSunsetTint: { value: new THREE.Color(0xff6622) },
        uMoonColor: { value: new THREE.Color(0x9fcfff) },
        uSunIntensity: { value: 1.0 },
        uMoonIntensity: { value: 0.0 },
        uStarsAlpha: { value: 0.0 },
        uTime: { value: 0.0 },
        uCloudCoverage: { value: 0.85 },
        uCloudTime: { value: 0.0 },
        uDarkness: { value: 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.skyMesh.renderOrder = -100;
    this.skyMesh.frustumCulled = false;
    this.scene.add(this.skyMesh);

    this.setTimeOfDay(0.5, false);
  }

  /**
   * Set target mode with smooth transition.
   * 'day' = 0.50 (solar noon)
   * 'sunset' = 0.76 (golden hour sunset)
   * 'night' = 0.03 (midnight starry sky)
   */
  public setMode(mode: DayNightMode, smooth: boolean = true) {
    let target = 0.5;
    if (mode === 'sunset') target = 0.76;
    else if (mode === 'night') target = 0.03;

    this.targetTimeOfDay = target;
    if (!smooth) {
      this.timeOfDay = target;
    }
  }

  /**
   * Set time of day (0.0 to 1.0).
   */
  public setTimeOfDay(t: number, smooth: boolean = true) {
    this.targetTimeOfDay = ((t % 1.0) + 1.0) % 1.0;
    if (!smooth) {
      this.timeOfDay = this.targetTimeOfDay;
    }
  }

  /**
   * Frame update: animates time, clouds, celestial orbits, and updates shader uniforms.
   */
  public update(delta: number, cameraPos: THREE.Vector3) {
    const dt = Math.min(delta, 0.1);
    this.totalTime += dt;
    this.cloudTime += dt;

    // 1. Advance time of day
    if (this.isAutoCycle) {
      this.timeOfDay = (this.timeOfDay + dt / this.cycleDurationSeconds) % 1.0;
      this.targetTimeOfDay = this.timeOfDay;
    } else {
      // Smoothly interpolate towards target time of day (shortest arc across 0..1 boundary)
      let diff = this.targetTimeOfDay - this.timeOfDay;
      while (diff < -0.5) diff += 1.0;
      while (diff > 0.5) diff -= 1.0;

      if (Math.abs(diff) > 0.0005) {
        this.timeOfDay = (this.timeOfDay + diff * Math.min(1.0, dt * 2.8)) % 1.0;
        if (this.timeOfDay < 0) this.timeOfDay += 1.0;
      } else {
        this.timeOfDay = this.targetTimeOfDay;
      }
    }

    // Keep sky sphere centered around camera so player never flies out of sky
    this.skyMesh.position.copy(cameraPos);

    // 2. Compute Celestial Orbits (Sun & Moon Trajectories)
    // t = 0.25 (6am sunrise), t = 0.50 (noon), t = 0.75 (6pm sunset), t = 0.0 / 1.0 (midnight)
    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunElevation = Math.sin(sunAngle); // Positive above horizon, negative below
    const sunAzimuth = Math.cos(sunAngle);

    // Sun direction vector
    this.sunDirection.set(
      sunAzimuth * 0.85,
      sunElevation,
      Math.sin(sunAngle * 0.5) * 0.45
    ).normalize();

    // Moon trajectory (opposite side with slight orbital inclination)
    this.moonDirection.copy(this.sunDirection).negate();
    this.moonDirection.y = Math.max(-1.0, Math.min(1.0, this.moonDirection.y + 0.12));
    this.moonDirection.normalize();

    // 3. Compute Atmospheric Colors & Lighting Factors
    const sunAboveHorizon = Math.max(0.0, this.sunDirection.y);
    const sunBelowHorizon = Math.max(0.0, -this.sunDirection.y);

    // Sunset factor: peaks when sun is near horizon (elevation -0.15 to +0.22)
    const sunsetFactor = Math.exp(-Math.pow((this.sunDirection.y - 0.05) / 0.16, 2.0));

    // Night factor: 1.0 when sun is well below horizon
    const nightFactor = Math.min(1.0, Math.max(0.0, (-this.sunDirection.y - 0.02) / 0.20));
    this.darknessFactor = nightFactor;

    // Zenith color: Day deep blue -> Sunset deep indigo/violet -> Night rich midnight navy
    const dayZenith = new THREE.Color(0x1a62ab);
    const sunsetZenith = new THREE.Color(0x28124d);
    const nightZenith = new THREE.Color(0x060c1c);

    this.currentZenithColor.copy(dayZenith);
    this.currentZenithColor.lerp(sunsetZenith, sunsetFactor);
    this.currentZenithColor.lerp(nightZenith, nightFactor);

    // Horizon color: Day bright cyan-blue haze -> Sunset fiery golden-orange -> Night dark misty blue
    const dayHorizon = new THREE.Color(0xa2d8fa);
    const sunsetHorizon = new THREE.Color(0xff6e1e);
    const nightHorizon = new THREE.Color(0x0c1730);

    this.currentHorizonColor.copy(dayHorizon);
    this.currentHorizonColor.lerp(sunsetHorizon, sunsetFactor);
    this.currentHorizonColor.lerp(nightHorizon, nightFactor);

    // Sun color: Day warm white -> Sunset glowing amber/crimson
    const daySun = new THREE.Color(0xfffaed);
    const sunsetSun = new THREE.Color(0xff5511);
    this.currentSunColor.copy(daySun).lerp(sunsetSun, sunsetFactor);

    // Moon color: Cool silver-blue glow
    this.currentMoonColor.setHex(0xa8d4ff);

    // Fog color: Matches horizon for seamless skyline blending
    this.currentFogColor.copy(this.currentHorizonColor);
    if (nightFactor > 0.5) {
      // Slightly deepen fog at night for rich skyscraper silhouette contrast
      this.currentFogColor.multiplyScalar(0.85);
    }

    // Stars visibility: fully visible at night, starts twinkling at dusk
    const starsAlpha = Math.max(0.0, Math.min(1.0, (nightFactor - 0.15) / 0.70));

    // Sun & Moon intensities
    const sunIntensity = Math.max(0.0, (this.sunDirection.y + 0.12) / 0.35);
    const moonIntensity = Math.max(0.0, (this.moonDirection.y + 0.08) / 0.35);

    // 4. Update Shader Uniforms
    const u = this.skyMaterial.uniforms;
    u.uSunDirection.value.copy(this.sunDirection);
    u.uMoonDirection.value.copy(this.moonDirection);
    u.uZenithColor.value.copy(this.currentZenithColor);
    u.uHorizonColor.value.copy(this.currentHorizonColor);
    u.uSunColor.value.copy(this.currentSunColor);
    u.uSunsetTint.value.setRGB(sunsetFactor * 1.2, sunsetFactor * 0.45, sunsetFactor * 0.08);
    u.uMoonColor.value.copy(this.currentMoonColor);
    u.uSunIntensity.value = sunIntensity;
    u.uMoonIntensity.value = moonIntensity;
    u.uStarsAlpha.value = starsAlpha;
    u.uTime.value = this.totalTime;
    u.uCloudCoverage.value = 0.84;
    u.uCloudTime.value = this.cloudTime;
    u.uDarkness.value = nightFactor;
  }

  public dispose() {
    this.scene.remove(this.skyMesh);
    this.skyMesh.geometry.dispose();
    this.skyMaterial.dispose();
  }
}
