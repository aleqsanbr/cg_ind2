//
// Отрисовка 3D объектов
//

let zBuffer = null;
let zBufferWidth = 0;
let zBufferHeight = 0;
let imageData = null;
let imageDataPixels = null;
let toonShadingLevels = 40;

const __textureCache = new WeakMap();

function getTextureCache(img) {
    if (__textureCache.has(img)) return __textureCache.get(img);

    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;

    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0);

    const data = cx.getImageData(0, 0, c.width, c.height).data;

    const res = { data, w: c.width, h: c.height };
    __textureCache.set(img, res);
    return res;
}

function initZBuffer(width, height) {
    zBufferWidth = width;
    zBufferHeight = height;
    zBuffer = new Float32Array(width * height);
    clearZBuffer();
}

function clearZBuffer() {
    if (!zBuffer) return;
    for (let i = 0; i < zBuffer.length; i++) {
        zBuffer[i] = Number.MAX_VALUE;
    }
}

function initImageData(ctx, width, height) {
    imageData = ctx.createImageData(width, height);
    imageDataPixels = imageData.data;
}

function commitImageData(ctx) {
    if (imageData) {
        ctx.putImageData(imageData, 0, 0);
    }
}

function parseColor(color) {
    const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslMatch) {
        const h = parseInt(hslMatch[1]) / 360;
        const s = parseInt(hslMatch[2]) / 100;
        const l = parseInt(hslMatch[3]) / 100;
        return hslToRgb(h, s, l);
    }

    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1]),
            g: parseInt(rgbMatch[2]),
            b: parseInt(rgbMatch[3])
        };
    }

    return { r: 255, g: 255, b: 255 };
}

function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

function getZBufferValue(x, y) {
    if (!zBuffer || x < 0 || x >= zBufferWidth || y < 0 || y >= zBufferHeight) {
        return Number.MAX_VALUE;
    }
    return zBuffer[y * zBufferWidth + x];
}

function setZBufferValue(x, y, value) {
    if (!zBuffer || x < 0 || x >= zBufferWidth || y < 0 || y >= zBufferHeight) {
        return;
    }
    zBuffer[y * zBufferWidth + x] = value;
}

// Функция для интерполяции Z-координаты в треугольнике
function interpolateZInTriangle(v0, v1, v2, p0, p1, p2, px, py) {
    const denom = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);

    if (Math.abs(denom) < 0.0001) {
        return (p0.z + p1.z + p2.z) / 3;
    }

    const w0 = ((v1.y - v2.y) * (px - v2.x) + (v2.x - v1.x) * (py - v2.y)) / denom;
    const w1 = ((v2.y - v0.y) * (px - v2.x) + (v0.x - v2.x) * (py - v2.y)) / denom;
    const w2 = 1 - w0 - w1;

    return w0 * p0.z + w1 * p1.z + w2 * p2.z;
}

function drawPolyhedron(ctx, polyhedron, projection, canvasWidth, canvasHeight, options = {}) {
    const {
        drawFaces = true,
        drawEdges = true,
        drawVertices = true,
        fillFaces = true,
        wireframeColor = '#00d4ff',
        faceColor = 'rgba(100, 150, 255, 0.3)',
        vertexColor = '#00ff88',
        edgeWidth = 2,
        vertexRadius = 4,
        enableCulling = false,
        viewDirection = { x: 0, y: 0, z: 1 },
        enableLighting = false,
        shadingMode = 'none', // 'none', 'gouraud', 'phong'
        light = null,
        material = null,
        enableZBuffer = false,
        texture = null // ДОБАВЛЯЕМ параметр текстуры
    } = options;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (enableZBuffer) {
        initZBuffer(canvasWidth, canvasHeight);
        initImageData(ctx, canvasWidth, canvasHeight);
    }

    const projected = projectPolyhedron(polyhedron, projection, canvasWidth, canvasHeight);
    const normals = computeAllFaceNormals(polyhedron);
    const camera = projection.type === ProjectionType.CAMERA ? projection.camera : null;

    // Если есть текстура и модель поддерживает UV-координаты, рисуем с текстурой
    if (drawFaces && texture && polyhedron.hasTextureCoordinates()) {
         drawFacesWithPatternTexture(ctx, polyhedron, projected, normals, projection, {
            fillFaces, enableCulling, viewDirection, camera, texture, enableZBuffer
        });
    } else if (drawFaces) {
        // Иначе используем существующую логику
        if (enableLighting && light && material && (shadingMode === 'gouraud' || shadingMode === 'phong')) {
            const vertexNormals = computeVertexNormals(polyhedron, normals);

            if (shadingMode === 'gouraud') {
                drawFacesWithGouraudShading(ctx, polyhedron, projected, normals, vertexNormals, projection, {
                    fillFaces, enableCulling, viewDirection, light, material, camera, enableZBuffer
                });
            } else if (shadingMode === 'phong') {
                drawFacesWithPhongShading(ctx, polyhedron, projected, normals, vertexNormals, projection, {
                    fillFaces, enableCulling, viewDirection, light, material, camera, enableZBuffer
                });
            }
        } else {
            drawFacesWithCulling(ctx, polyhedron, projected, normals, projection, {
                fillFaces, faceColor, enableCulling, viewDirection, camera, enableZBuffer
            });
        }
    }

    if (enableZBuffer) {
        commitImageData(ctx);
    }

    if (drawEdges) drawEdgesWithCulling(ctx, polyhedron, projected, normals, projection, { wireframeColor, edgeWidth, enableCulling, viewDirection, camera, enableZBuffer, enableCullingDashedEdges });
    if (drawVertices) drawVerticesPoints(ctx, projected, vertexColor, vertexRadius);
}

function drawFacesWithTexture(ctx, polyhedron, projected, normals, projection, options) {
    const { fillFaces, enableCulling, viewDirection, camera, texture, enableZBuffer } = options;

    if (!fillFaces || !texture) return;

    // Подготавливаем текстуру
    const texCanvas = document.createElement('canvas');
    texCanvas.width = texture.width;
    texCanvas.height = texture.height;
    const texCtx = texCanvas.getContext('2d');
    texCtx.drawImage(texture, 0, 0);
    const texData = texCtx.getImageData(0, 0, texture.width, texture.height);

    polyhedron.faces.forEach((face, index) => {
        // Проверка видимости грани
        if (enableCulling && !isFaceVisible(face, polyhedron.vertices, normals[index], viewDirection, projection.type, camera)) {
            return;
        }

        // Рисуем грань как полигон
        if (face.vertexIndices.length >= 3) {
            ctx.beginPath();

            // Начинаем с первой вершины
            const firstIndex = face.vertexIndices[0];
            const firstProj = projected.vertices[firstIndex];
            ctx.moveTo(firstProj.x, firstProj.y);

            // Проходим по остальным вершинам
            for (let i = 1; i < face.vertexIndices.length; i++) {
                const vIndex = face.vertexIndices[i];
                const proj = projected.vertices[vIndex];
                ctx.lineTo(proj.x, proj.y);
            }

            ctx.closePath();

            // Создаем заливку с текстурой
            if (face.vertexIndices.length === 3 || face.vertexIndices.length === 4) {
                // Для треугольников и четырехугольников используем градиент как простую текстуру
                const pattern = ctx.createPattern(texture, 'repeat');
                if (pattern) {
                    ctx.fillStyle = pattern;
                    ctx.fill();
                } else {
                    // Fallback: цветная заливка
                    ctx.fillStyle = 'rgba(100, 150, 255, 0.5)';
                    ctx.fill();
                }
            } else {
                // Для других полигонов - простая заливка
                ctx.fillStyle = 'rgba(100, 150, 255, 0.5)';
                ctx.fill();
            }
        }
    });
}

function drawFacesWithPatternTexture(ctx, polyhedron, projected, normals, projection, options) {
    const { fillFaces, enableCulling, viewDirection, camera, texture } = options;

    if (!fillFaces || !texture || !polyhedron.texCoords) return;

    // Подготавливаем текстуру
    const texCanvas = document.createElement('canvas');
    texCanvas.width = texture.width;
    texCanvas.height = texture.height;
    const texCtx = texCanvas.getContext('2d');
    texCtx.drawImage(texture, 0, 0);
    const texData = texCtx.getImageData(0, 0, texture.width, texture.height);

    polyhedron.faces.forEach((face, index) => {
        // Проверка видимости грани
        if (enableCulling && !isFaceVisible(face, polyhedron.vertices, normals[index], viewDirection, projection.type, camera)) {
            return;
        }

        // Рисуем каждый треугольник в грани с текстурой
        if (face.vertexIndices.length >= 3) {
            // Разбиваем полигон на треугольники (веерное разбиение)
            for (let i = 1; i < face.vertexIndices.length - 1; i++) {
                const v0Idx = face.vertexIndices[0];
                const v1Idx = face.vertexIndices[i];
                const v2Idx = face.vertexIndices[i + 1];

                // Получаем UV-координаты для вершин
                const uv0Idx = face.uvIndices ? face.uvIndices[0] : v0Idx;
                const uv1Idx = face.uvIndices ? face.uvIndices[i] : v1Idx;
                const uv2Idx = face.uvIndices ? face.uvIndices[i + 1] : v2Idx;

                const uv0 = polyhedron.texCoords[uv0Idx];
                const uv1 = polyhedron.texCoords[uv1Idx];
                const uv2 = polyhedron.texCoords[uv2Idx];

                if (uv0 && uv1 && uv2) {
                    drawTexturedTriangle(
                        ctx,
                        projected.vertices[v0Idx],
                        projected.vertices[v1Idx],
                        projected.vertices[v2Idx],
                        uv0, uv1, uv2,
                        texData,
                        texture.width,
                        texture.height
                    );
                }
            }
        }
    });
}

function drawTexturedTriangle(ctx, p0, p1, p2, uv0, uv1, uv2, texData, texWidth, texHeight) {
    // Находим границы треугольника
    const minX = Math.floor(Math.min(p0.x, p1.x, p2.x));
    const maxX = Math.ceil(Math.max(p0.x, p1.x, p2.x));
    const minY = Math.floor(Math.min(p0.y, p1.y, p2.y));
    const maxY = Math.ceil(Math.max(p0.y, p1.y, p2.y));

    // Вычисляем матрицу для преобразования барицентрических координат
    const denom = (p1.y - p2.y) * (p0.x - p2.x) + (p2.x - p1.x) * (p0.y - p2.y);

    if (Math.abs(denom) < 0.0001) return;

    // Рисуем попиксельно
    for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
            // Проверяем, находится ли точка внутри треугольника
            const w0 = ((p1.y - p2.y) * (px - p2.x) + (p2.x - p1.x) * (py - p2.y)) / denom;
            const w1 = ((p2.y - p0.y) * (px - p2.x) + (p0.x - p2.x) * (py - p2.y)) / denom;
            const w2 = 1 - w0 - w1;

            if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
                // Интерполируем UV-координаты
                const u = uv0.u * w0 + uv1.u * w1 + uv2.u * w2;
                const v = uv0.v * w0 + uv1.v * w1 + uv2.v * w2;

                // Берем цвет из текстуры (с наложением, если выходим за границы [0,1])
                const texX = Math.floor((u % 1) * (texWidth - 1));
                const texY = Math.floor((v % 1) * (texHeight - 1));

                const texIndex = (texY * texWidth + texX) * 4;
                const r = texData.data[texIndex];
                const g = texData.data[texIndex + 1];
                const b = texData.data[texIndex + 2];
                const a = texData.data[texIndex + 3];

                // Рисуем пиксель
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                ctx.fillRect(px, py, 1, 1);
            }
        }
    }
}

function drawTexturedTriangleOptimized(ctx, p0, p1, p2, uv0, uv1, uv2, texData, texWidth, texHeight) {
    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(ctx.canvas.width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(ctx.canvas.height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

    const denom = (p1.y - p2.y) * (p0.x - p2.x) + (p2.x - p1.x) * (p0.y - p2.y);
    if (Math.abs(denom) < 0.0001) return;

    // Создаем временный ImageData для этого треугольника
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Заполняем ImageData
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const w0 = ((p1.y - p2.y) * (x - p2.x) + (p2.x - p1.x) * (y - p2.y)) / denom;
            const w1 = ((p2.y - p0.y) * (x - p2.x) + (p0.x - p2.x) * (y - p2.y)) / denom;
            const w2 = 1 - w0 - w1;

            if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
                const u = uv0.u * w0 + uv1.u * w1 + uv2.u * w2;
                const v = uv0.v * w0 + uv1.v * w1 + uv2.v * w2;

                // Обрезаем UV в диапазон [0, 1]
                const texU = Math.max(0, Math.min(1, u));
                const texV = Math.max(0, Math.min(1, v));

                const texX = Math.floor(texU * (texWidth - 1));
                const texY = Math.floor(texV * (texHeight - 1));

                const texIndex = (texY * texWidth + texX) * 4;
                const dataIndex = ((y - minY) * width + (x - minX)) * 4;

                data[dataIndex] = texData.data[texIndex];         // R
                data[dataIndex + 1] = texData.data[texIndex + 1]; // G
                data[dataIndex + 2] = texData.data[texIndex + 2]; // B
                data[dataIndex + 3] = texData.data[texIndex + 3]; // A
            }
        }
    }

    // Рисуем ImageData
    ctx.putImageData(imageData, minX, minY);
}

function drawTexturedTriangleWithZBuffer(ctx, p0, p1, p2, uv0, uv1, uv2, texData, texWidth, texHeight, zBuffer, zBufferWidth) {
    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(ctx.canvas.width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(ctx.canvas.height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

    const denom = (p1.y - p2.y) * (p0.x - p2.x) + (p2.x - p1.x) * (p0.y - p2.y);
    if (Math.abs(denom) < 0.0001) return;

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const w0 = ((p1.y - p2.y) * (x - p2.x) + (p2.x - p1.x) * (y - p2.y)) / denom;
            const w1 = ((p2.y - p0.y) * (x - p2.x) + (p0.x - p2.x) * (y - p2.y)) / denom;
            const w2 = 1 - w0 - w1;

            if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
                // Интерполируем глубину
                const depth = w0 * p0.depth + w1 * p1.depth + w2 * p2.depth;
                const bufferIndex = y * zBufferWidth + x;

                // Проверка Z-буфера
                if (depth < zBuffer[bufferIndex]) {
                    zBuffer[bufferIndex] = depth;

                    // Интерполируем UV
                    const u = uv0.u * w0 + uv1.u * w1 + uv2.u * w2;
                    const v = uv0.v * w0 + uv1.v * w1 + uv2.v * w2;

                    const texU = Math.max(0, Math.min(1, u));
                    const texV = Math.max(0, Math.min(1, v));

                    const texX = Math.floor(texU * (texWidth - 1));
                    const texY = Math.floor(texV * (texHeight - 1));

                    const texIndex = (texY * texWidth + texX) * 4;

                    // Рисуем пиксель
                    ctx.fillStyle = `rgba(${texData.data[texIndex]}, ${texData.data[texIndex + 1]}, ${texData.data[texIndex + 2]}, ${texData.data[texIndex + 3] / 255})`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
}

function drawTexturedTriangleZ(ctx, p0, p1, p2, uv0, uv1, uv2, texture, zBuffer, canvasWidth, canvasHeight) {
    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(canvasWidth - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(canvasHeight - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

    const texCanvas = document.createElement('canvas');
    texCanvas.width = texture.width;
    texCanvas.height = texture.height;
    const texCtx = texCanvas.getContext('2d');
    texCtx.drawImage(texture, 0, 0);
    const texData = texCtx.getImageData(0, 0, texture.width, texture.height);

    const denom = (p1.y - p2.y)*(p0.x - p2.x) + (p2.x - p1.x)*(p0.y - p2.y);

    const canvasData = ctx.getImageData(minX, minY, maxX - minX + 1, maxY - minY + 1);
    const width = maxX - minX + 1;

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const alpha = ((p1.y - p2.y)*(x - p2.x) + (p2.x - p1.x)*(y - p2.y)) / denom;
            const beta  = ((p2.y - p0.y)*(x - p2.x) + (p0.x - p2.x)*(y - p2.y)) / denom;
            const gamma = 1 - alpha - beta;

            if (alpha >= 0 && beta >= 0 && gamma >= 0) {
                const z = alpha * p0.depth + beta * p1.depth + gamma * p2.depth;

                // Проверка Z-буфера если он есть
                let shouldDraw = true;
                if (zBuffer) {
                    const bufIndex = y * canvasWidth + x;
                    if (z > zBuffer[bufIndex]) {
                        zBuffer[bufIndex] = z;
                    } else {
                        shouldDraw = false;
                    }
                }

                if (shouldDraw) {
                    const u = uv0.u * alpha + uv1.u * beta + uv2.u * gamma;
                    const v = uv0.v * alpha + uv1.v * beta + uv2.v * gamma;

                    const tx = Math.floor(u * (texture.width - 1));
                    const ty = Math.floor(v * (texture.height - 1));

                    const texIndex = (ty * texture.width + tx) * 4;
                    const r = texData.data[texIndex];
                    const g = texData.data[texIndex + 1];
                    const b = texData.data[texIndex + 2];
                    const a = texData.data[texIndex + 3];

                    const canvasIndex = ((y - minY) * width + (x - minX)) * 4;
                    canvasData.data[canvasIndex] = r;
                    canvasData.data[canvasIndex + 1] = g;
                    canvasData.data[canvasIndex + 2] = b;
                    canvasData.data[canvasIndex + 3] = a;
                }
            }
        }
    }

    ctx.putImageData(canvasData, minX, minY);
}


function drawFacesWithCulling(ctx, polyhedron, projected, normals, projection, options) {
    const { fillFaces, faceColor, enableCulling, viewDirection, camera, enableZBuffer } = options;

    if (!fillFaces) return;

    polyhedron.faces.forEach((face, index) => {
        // Генерируем разные цвета для каждой грани (для отладки Z-buffer)
        const hue = (index * 360 / polyhedron.faces.length) % 360;
        const displayColor = `hsl(${hue}, 70%, 60%)`;

        if (enableZBuffer && face.vertexIndices.length >= 3) {
            for (let i = 1; i < face.vertexIndices.length - 1; i++) {
                const triangleIndices = [face.vertexIndices[0], face.vertexIndices[i], face.vertexIndices[i + 1]];
                drawTriangleWithZBuffer(ctx, triangleIndices, polyhedron.vertices, projected.vertices, displayColor, projection);
            }
        } else {
            const isVisible = !enableCulling || isFaceVisible(face, polyhedron.vertices, normals[index], viewDirection, projection.type, camera);

            if (enableCulling && !isVisible) return;

            ctx.fillStyle = displayColor;
            ctx.beginPath();

            face.vertexIndices.forEach((vIndex, i) => {
                const p = projected.vertices[vIndex];
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });

            ctx.closePath();
            ctx.fill();
        }
    });
}

function drawTriangleWithZBuffer(ctx, vertexIndices, vertices3D, projectedVertices, color, projection) {
    const [i0, i1, i2] = vertexIndices;

    const v0 = projectedVertices[i0];
    const v1 = projectedVertices[i1];
    const v2 = projectedVertices[i2];

    const minX = Math.max(0, Math.floor(Math.min(v0.x, v1.x, v2.x)));
    const maxX = Math.min(zBufferWidth - 1, Math.ceil(Math.max(v0.x, v1.x, v2.x)));
    const minY = Math.max(0, Math.floor(Math.min(v0.y, v1.y, v2.y)));
    const maxY = Math.min(zBufferHeight - 1, Math.ceil(Math.max(v0.y, v1.y, v2.y)));

    const depth0 = v0.depth !== undefined ? v0.depth : 0;
    const depth1 = v1.depth !== undefined ? v1.depth : 0;
    const depth2 = v2.depth !== undefined ? v2.depth : 0;

    for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
            if (isPointInTriangle(px, py, v0, v1, v2)) {
                // Интерполируем глубину
                const depthValue = interpolateZInTriangle(v0, v1, v2,
                    {x: v0.x, y: v0.y, z: depth0},
                    {x: v1.x, y: v1.y, z: depth1},
                    {x: v2.x, y: v2.y, z: depth2},
                    px, py
                );

                // Для режима камеры глубина отрицательная (нужно инвертировать)
                // Для остальных режимов depth уже положительная (расстояние от наблюдателя)
                let finalDepth = depthValue;
                if (projection.type === ProjectionType.CAMERA) {
                    finalDepth = -depthValue;
                }

                // Проверка Z-buffer: рисуем только если пиксель ближе (меньшее значение)
                if (finalDepth < getZBufferValue(px, py)) {
                    setZBufferValue(px, py, finalDepth);

                    if (imageDataPixels) {
                        const index = (py * zBufferWidth + px) * 4;

                        const rgb = parseColor(color);
                        imageDataPixels[index] = rgb.r;
                        imageDataPixels[index + 1] = rgb.g;
                        imageDataPixels[index + 2] = rgb.b;
                        imageDataPixels[index + 3] = 255;
                    }
                }
            }
        }
    }
}

function drawEdgesWithCulling(ctx, polyhedron, projected, normals, projection, options) {
    const { wireframeColor, edgeWidth, enableCulling, viewDirection, camera, enableZBuffer, enableCullingDashedEdges } = options;

    ctx.strokeStyle = wireframeColor;
    ctx.lineWidth = edgeWidth;

    if (enableZBuffer || enableCulling) {
        const visibleEdges = new Set();
        const invisibleEdges = new Set();

        polyhedron.faces.forEach((face, index) => {
            const isVisible = isFaceVisible(face, polyhedron.vertices, normals[index], viewDirection, projection.type, camera);

            for (let i = 0; i < face.vertexIndices.length; i++) {
                const v1 = face.vertexIndices[i];
                const v2 = face.vertexIndices[(i + 1) % face.vertexIndices.length];
                const edgeKey = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;

                if (isVisible) {
                    visibleEdges.add(edgeKey);
                } else {
                    invisibleEdges.add(edgeKey);
                }
            }
        });

        invisibleEdges.forEach((key) => {
            if (visibleEdges.has(key)) invisibleEdges.delete(key);
        });

        if (enableCullingDashedEdges) {
            ctx.setLineDash([5, 5]);
            ctx.globalAlpha = 0.3;
            invisibleEdges.forEach((key) => {
                const [v1, v2] = key.split('-').map(Number);
                drawEdge(ctx, projected, v1, v2);
            });
        }

        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        visibleEdges.forEach((key) => {
            const [v1, v2] = key.split('-').map(Number);
            drawEdge(ctx, projected, v1, v2);
        });
    } else {
        projected.edges.forEach(([v1Index, v2Index]) => {
            drawEdge(ctx, projected, v1Index, v2Index);
        });
    }

    ctx.globalAlpha = 1;
}

function drawEdge(ctx, projected, v1, v2) {
    const p1 = projected.vertices[v1];
    const p2 = projected.vertices[v2];
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
}

function drawVerticesPoints(ctx, projected, vertexColor, vertexRadius) {
    ctx.fillStyle = vertexColor;

    projected.vertices.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, vertexRadius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawAxes(ctx, projection, canvasWidth, canvasHeight, axisLength = 150) {
    const origin = new Point3D(0, 0, 0);
    const xAxis = new Point3D(axisLength, 0, 0);
    const yAxis = new Point3D(0, axisLength, 0);
    const zAxis = new Point3D(0, 0, axisLength);

    const originProj = projection.project(origin, canvasWidth, canvasHeight);
    const xAxisProj = projection.project(xAxis, canvasWidth, canvasHeight);
    const yAxisProj = projection.project(yAxis, canvasWidth, canvasHeight);
    const zAxisProj = projection.project(zAxis, canvasWidth, canvasHeight);

    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.globalAlpha = 0.4;

    ctx.strokeStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(originProj.x, originProj.y);
    ctx.lineTo(xAxisProj.x, xAxisProj.y);
    ctx.stroke();

    ctx.strokeStyle = '#44ff44';
    ctx.beginPath();
    ctx.moveTo(originProj.x, originProj.y);
    ctx.lineTo(yAxisProj.x, yAxisProj.y);
    ctx.stroke();

    ctx.strokeStyle = '#4444ff';
    ctx.beginPath();
    ctx.moveTo(originProj.x, originProj.y);
    ctx.lineTo(zAxisProj.x, zAxisProj.y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.globalAlpha = 0.6;
    ctx.fillText('X', xAxisProj.x + 10, xAxisProj.y);
    ctx.fillText('Y', yAxisProj.x, yAxisProj.y - 10);
    ctx.fillText('Z', zAxisProj.x, zAxisProj.y + 20);
    ctx.globalAlpha = 1;
}

// =========================== Освещение ===========================

/**
 * Рисует грани с шейдингом Гуро (модель Ламберта)
 * Вычисляет цвет в каждой вершине и интерполирует между ними
 */
function drawFacesWithGouraudShading(ctx, polyhedron, projected, faceNormals, vertexNormals, projection, options) {
    const { fillFaces, enableCulling, viewDirection, light, material, camera } = options;

    if (!fillFaces) return;

    polyhedron.faces.forEach((face, index) => {
        // Проверка видимости грани
        if (enableCulling && !isFaceVisible(face, polyhedron.vertices, faceNormals[index], viewDirection, projection.type, camera)) {
            return;
        }

        // Если грань не треугольник, разбиваем на треугольники
        if (face.vertexIndices.length === 3) {
            drawTriangleGouraud(ctx, face.vertexIndices, polyhedron.vertices, projected.vertices, vertexNormals, light, material);
        } else {
            // Разбиваем полигон на треугольники веерным методом
            for (let i = 1; i < face.vertexIndices.length - 1; i++) {
                const triangleIndices = [face.vertexIndices[0], face.vertexIndices[i], face.vertexIndices[i + 1]];
                drawTriangleGouraud(ctx, triangleIndices, polyhedron.vertices, projected.vertices, vertexNormals, light, material);
            }
        }
    });
}

/**
 * Рисует один треугольник с шейдингом Гуро
 */
function drawTriangleGouraud(ctx, vertexIndices, vertices3D, projectedVertices, vertexNormals, light, material) {
    const [i0, i1, i2] = vertexIndices;

    // 3D позиции вершин
    const p0 = vertices3D[i0];
    const p1 = vertices3D[i1];
    const p2 = vertices3D[i2];

    // 2D проекции вершин
    const v0 = projectedVertices[i0];
    const v1 = projectedVertices[i1];
    const v2 = projectedVertices[i2];

    // Нормали вершин
    const n0 = vertexNormals[i0];
    const n1 = vertexNormals[i1];
    const n2 = vertexNormals[i2];

    // Вычисляем цвета в вершинах по модели Ламберта
    const c0 = lambertShading(n0, p0, light, material);
    const c1 = lambertShading(n1, p1, light, material);
    const c2 = lambertShading(n2, p2, light, material);

    // Находим границы треугольника
    const minX = Math.floor(Math.min(v0.x, v1.x, v2.x));
    const maxX = Math.ceil(Math.max(v0.x, v1.x, v2.x));
    const minY = Math.floor(Math.min(v0.y, v1.y, v2.y));
    const maxY = Math.ceil(Math.max(v0.y, v1.y, v2.y));

    // Растеризация треугольника попиксельно
    for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
            // Проверяем, находится ли точка внутри треугольника
            if (isPointInTriangle(px, py, v0, v1, v2)) {
                // TODO: Добавить проверку z-buffer здесь
                // const position3D = interpolatePositionInTriangle(v0, v1, v2, p0, p1, p2, px, py);
                // if (position3D.z < zBuffer[px][py]) {
                //   zBuffer[px][py] = position3D.z;
                //   ... рисовать пиксель
                // }

                // Интерполируем цвет
                const color = interpolateColorInTriangle(v0, v1, v2, c0, c1, c2, px, py);
                ctx.fillStyle = colorToCSS(color);
                ctx.fillRect(px, py, 1, 1);
            }
        }
    }
}

/**
 * Рисует один треугольник с шейдингом Фонга (Toon Shading)
 */
// В функции drawTrianglePhong заменим вызов toonShading на phongToonShading
function drawTrianglePhong(ctx, vertexIndices, vertices3D, projectedVertices, vertexNormals, light, material, viewPosition) {
    const [i0, i1, i2] = vertexIndices;

    // 3D позиции вершин
    const p0 = vertices3D[i0];
    const p1 = vertices3D[i1];
    const p2 = vertices3D[i2];

    // 2D проекции вершин
    const v0 = projectedVertices[i0];
    const v1 = projectedVertices[i1];
    const v2 = projectedVertices[i2];

    // Нормали вершин
    const n0 = vertexNormals[i0];
    const n1 = vertexNormals[i1];
    const n2 = vertexNormals[i2];

    // Находим границы треугольника
    const minX = Math.floor(Math.min(v0.x, v1.x, v2.x));
    const maxX = Math.ceil(Math.max(v0.x, v1.x, v2.x));
    const minY = Math.floor(Math.min(v0.y, v1.y, v2.y));
    const maxY = Math.ceil(Math.max(v0.y, v1.y, v2.y));

    // Растеризация треугольника попиксельно
    for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
            // Проверяем, находится ли точка внутри треугольника
            if (isPointInTriangle(px, py, v0, v1, v2)) {
                // Интерполируем нормаль
                const normal = interpolateNormalInTriangle(v0, v1, v2, n0, n1, n2, px, py);

                // Интерполируем 3D позицию
                const position = interpolatePositionInTriangle(v0, v1, v2, p0, p1, p2, px, py);

                // Вычисляем цвет по модели Фонга + Туншейдинг
                const color = phongToonShading(normal, position, light, material, viewPosition, toonShadingLevels);

                ctx.fillStyle = colorToCSS(color);
                ctx.fillRect(px, py, 1, 1);
            }
        }
    }
}

// Обновим функцию drawFacesWithPhongShading
function drawFacesWithPhongShading(ctx, polyhedron, projected, faceNormals, vertexNormals, projection, options) {
    const { fillFaces, enableCulling, viewDirection, light, material, camera } = options;

    if (!fillFaces) return;

    // Получаем позицию наблюдателя (камеры)
    let viewPosition;
    if (camera && projection.type === ProjectionType.CAMERA) {
        viewPosition = camera.position;
    } else {
        // Для перспективной проекции - позиция наблюдателя на оси Z
        viewPosition = new Point3D(0, 0, 1000);
    }

    polyhedron.faces.forEach((face, index) => {
        // Проверка видимости грани
        if (enableCulling && !isFaceVisible(face, polyhedron.vertices, faceNormals[index], viewDirection, projection.type, camera)) {
            return;
        }

        // Если грань не треугольник, разбиваем на треугольники
        if (face.vertexIndices.length === 3) {
            drawTrianglePhong(ctx, face.vertexIndices, polyhedron.vertices, projected.vertices, vertexNormals, light, material, viewPosition);
        } else {
            // Разбиваем полигон на треугольники веерным методом
            for (let i = 1; i < face.vertexIndices.length - 1; i++) {
                const triangleIndices = [face.vertexIndices[0], face.vertexIndices[i], face.vertexIndices[i + 1]];
                drawTrianglePhong(ctx, triangleIndices, polyhedron.vertices, projected.vertices, vertexNormals, light, material, viewPosition);
            }
        }
    });
}

/**
 * Проверяет, находится ли точка внутри треугольника
 * Использует барицентрические координаты
 */
function isPointInTriangle(px, py, v0, v1, v2) {
    const denom = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);

    if (Math.abs(denom) < 0.0001) {
        return false;
    }

    const w0 = ((v1.y - v2.y) * (px - v2.x) + (v2.x - v1.x) * (py - v2.y)) / denom;
    const w1 = ((v2.y - v0.y) * (px - v2.x) + (v0.x - v2.x) * (py - v2.y)) / denom;
    const w2 = 1 - w0 - w1;

    return w0 >= 0 && w1 >= 0 && w2 >= 0;
}
