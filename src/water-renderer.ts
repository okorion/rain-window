const vertex = `
attribute vec2 corner;
attribute vec4 geometry;
attribute vec2 material;
uniform vec2 size;
varying vec2 local;
varying vec2 center;
varying vec2 radius;
varying vec2 surface;
void main() {
  local = corner; center = geometry.xy; radius = geometry.zw; surface = material;
  vec2 p = (center + corner * radius) / size;
  gl_Position = vec4(p.x * 2. - 1., 1. - p.y * 2., 0., 1.);
}
`;
const fragment = `
precision highp float;
uniform sampler2D scene;
uniform vec2 size;
varying vec2 local;
varying vec2 center;
varying vec2 radius;
varying vec2 surface;
vec3 city(vec2 p) { return texture2D(scene, clamp(vec2(p.x, 1. - p.y), 0., 1.)).rgb; }
void main() {
  // Gravity broadens the bottom; every cap is smooth at subpixel resolution.
  float impact = max(0., -surface.y);
  float taper = 1. + local.y * max(0., surface.y) * 0.18;
  vec2 p = vec2(local.x / taper, local.y);
  float lobes = sin(atan(p.y, p.x) * 5. + 0.7) * 0.045 * impact;
  p /= 1. + lobes;
  float r2 = dot(p, p);
  if (r2 >= 1.) discard;
  float z = sqrt(1. - r2);
  float edge = 1. - smoothstep(0.78, 1., r2);
  vec2 uv = (center + local * radius) / size;
  // Refraction through a convex cap: inverted miniature of the surrounding city,
  // gradually stronger at the edge. Not a cropped copy or a painted bright rim.
  vec2 lens = p * (10. + radius.x * 3.) * (0.55 + z * 0.45);
  vec3 transmitted = city((center - lens) / size);
  float fresnel = 0.025 + 0.45 * pow(1. - z, 4.);
  vec3 reflected = city(uv + p * vec2(0.12, 0.18));
  vec3 color = mix(transmitted, reflected, fresnel);
  // A restrained lower caustic and upper meniscus, colored by the environment.
  color *= 0.88 + 0.2 * p.y;
  vec3 light = city(uv + vec2(-0.03, -0.12));
  float glint = exp(-dot(p - vec2(-0.25, 0.64), p - vec2(-0.25, 0.64)) * 32.);
  color += (light * 0.6 + vec3(0.06, 0.075, 0.08)) * glint;
  color += vec3(0.055, 0.07, 0.075) * impact * (1. - r2);
  gl_FragColor = vec4(color, edge * surface.x);
}
`;
const corners = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
export const WATER_SPRITE_LIMIT = 5800;

/** Analytic curved caps in a single batch: no low precision height-map artifacts. */
export class WaterRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private texture: WebGLTexture;
  private canvas: HTMLCanvasElement;
  private city: HTMLCanvasElement;
  private vertices = new Float32Array(WATER_SPRITE_LIMIT * 6 * 8);
  private count = 0;
  constructor(canvas: HTMLCanvasElement, city: HTMLCanvasElement) {
    this.canvas = canvas;
    this.city = city;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message || "Shader compilation failed");
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex),
      fs = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      throw new Error("Water shader link failed");
    }
    this.program = program;
    gl.useProgram(program);
    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
    for (const [name, length, offset] of [
      ["corner", 2, 0],
      ["geometry", 4, 8],
      ["material", 2, 24],
    ] as const) {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, length, gl.FLOAT, false, 32, offset);
    }
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, "scene"), 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );
    canvas.dataset.renderer = "webgl";
  }
  resize(w: number, h: number) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(gl.getUniformLocation(this.program, "size"), w, h);
    this.refreshScene();
  }
  refreshScene() {
    const gl = this.gl;
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.city,
    );
  }
  begin() {
    this.count = 0;
  }
  bead(
    x: number,
    y: number,
    rx: number,
    ry: number,
    opacity: number,
    taper = 0,
  ) {
    if (this.count >= WATER_SPRITE_LIMIT || rx < 0.15 || opacity <= 0) return;
    let offset = this.count * 48;
    for (let i = 0; i < 6; i++) {
      this.vertices.set(
        [corners[i * 2], corners[i * 2 + 1], x, y, rx, ry, opacity, taper],
        offset,
      );
      offset += 8;
    }
    this.count++;
  }
  render() {
    const gl = this.gl;
    if (gl.isContextLost()) throw new Error("Water context lost");
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.vertices.subarray(0, this.count * 48),
    );
    gl.drawArrays(gl.TRIANGLES, 0, this.count * 6);
  }
  destroy() {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.program);
  }
}
