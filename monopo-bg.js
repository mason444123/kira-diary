(function() {
  const canvas = document.getElementById('monopo-bg');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: false, alpha: false });
  if (!gl) return;

  let width, height;
  let startTime = Date.now();

  // Вершинный шейдер
  const vs = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `;

  // Фрагментный шейдер с улучшенным шумом и цветами из токенов
  const fs = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;

    // Точные цвета из дизайн-токенов monopo
    vec3 bg = vec3(0.0, 0.0, 0.0);          // Midnight Canvas #000000
    vec3 cGreen = vec3(160.0/255.0, 224.0/255.0, 171.0/255.0); // Deep Ocean Gradient start
    vec3 cOrange = vec3(255.0/255.0, 172.0/255.0, 46.0/255.0);  // Deep Ocean Gradient mid
    vec3 cRed = vec3(165.0/255.0, 45.0/255.0, 37.0/255.0);      // Deep Ocean Gradient end

    // Simplex Noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    // Функция шума для текстуры (Grain)
    float rand(vec2 n) { 
      return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    }
    float noise(vec2 p){
      vec2 ip = floor(p);
      vec2 u = fract(p);
      u = u*u*(3.0-2.0*u);
      float res = mix(
        mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
        mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
      return res*res;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      uv.x *= u_resolution.x / u_resolution.y;

      // Анимация "переливов" (Shifting gradients)
      float t = u_time * 0.06;
      
      // Создаем "пятна" света с разной скоростью
      float n1 = snoise(uv * 2.0 + vec2(t));
      float n2 = snoise(uv * 3.5 - vec2(t * 1.3));
      float n3 = snoise(uv * 1.5 + vec2(t * 0.8, t * 0.5));

      // Смешиваем цвета как на референсе: Зеленый -> Оранжевый -> Красноватый
      vec3 col = mix(bg, cGreen, smoothstep(-0.3, 0.6, n1));
      col = mix(col, cOrange, smoothstep(0.1, 0.8, n2));
      col = mix(col, cRed, smoothstep(0.4, 1.0, n3));

      // Добавляем "глубину" через виньетку и шум
      float dist = length(uv - 0.5) * 1.2;
      col *= smoothstep(1.0, 0.2, dist);

      // Добавляем зернистость (Film Grain) для атмосферы monopo
      float grain = noise(gl_FragCoord.xy * 0.8 + u_time * 50.0) * 0.06;
      col += grain;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function createShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  gl.useProgram(program);

  const posLoc = gl.getAttribLocation(program, "a_position");
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const resLoc = gl.getUniformLocation(program, "u_resolution");
  const timeLoc = gl.getUniformLocation(program, "u_time");

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    gl.viewport(0, 0, width, height);
  }

  function loop() {
    const time = (Date.now() - startTime) / 1000;
    gl.uniform2f(resLoc, width, height);
    gl.uniform1f(timeLoc, time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  loop();
})();
