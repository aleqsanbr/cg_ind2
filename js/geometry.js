//
// Классы, матричные преобразования
//

class Point3D {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    clone() {
        return new Point3D(this.x, this.y, this.z);
    }
}

class UV {
    constructor(u, v) {
        this.u = u;
        this.v = v;
    }

    clone() {
        return new UV(this.u, this.v);
    }
}

class Face {
    constructor(vertexIndices, uvIndices = null) {
        this.vertexIndices = vertexIndices;
        this.uvIndices = uvIndices || vertexIndices; // По умолчанию совпадают с vertexIndices
    }
}

class Polyhedron {
    constructor(vertices, faces, edges = null, name = 'Polyhedron', texCoords = null) {
        this.vertices = vertices;
        this.faces = faces;
        this.edges = edges;
        this.name = name;
        this.texCoords = texCoords || [];
    }

    clone() {
        const newVertices = this.vertices.map((v) => v.clone());
        const newFaces = this.faces.map((f) => new Face([...f.vertexIndices], f.uvIndices ? [...f.uvIndices] : null));
        const newEdges = this.edges ? this.edges.map((edge) => [...edge]) : null;
        const newTexCoords = this.texCoords.map((uv) => uv.clone());
        return new Polyhedron(newVertices, newFaces, newEdges, this.name, newTexCoords);
    }

    getCenter() {
        const sum = this.vertices.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }), { x: 0, y: 0, z: 0 });
        const n = this.vertices.length;
        return new Point3D(sum.x / n, sum.y / n, sum.z / n);
    }

    getEdges() {
        if (this.edges && this.edges.length > 0) {
            return this.edges;
        }

        const edges = [];
        const edgeSet = new Set();

        this.faces.forEach((face) => {
            for (let i = 0; i < face.vertexIndices.length; i++) {
                const v1 = face.vertexIndices[i];
                const v2 = face.vertexIndices[(i + 1) % face.vertexIndices.length];
                const edgeKey = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;

                if (!edgeSet.has(edgeKey)) {
                    edgeSet.add(edgeKey);
                    edges.push([v1, v2]);
                }
            }
        });

        return edges;
    }

    applyTransformation(matrix) {
        this.vertices = this.vertices.map((v) => applyMatrix4(v, matrix));
    }

    // Проверка наличия UV-координат
    hasTextureCoordinates() {
        return this.texCoords && this.texCoords.length > 0;
    }
}

function createIdentityMatrix() {
    return [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
}

function multiplyMatrices4(m1, m2) {
    const result = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ];

    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            for (let k = 0; k < 4; k++) {
                result[i][j] += m1[i][k] * m2[k][j];
            }
        }
    }

    return result;
}

function applyMatrix4(point, matrix) {
    const x = point.x * matrix[0][0] + point.y * matrix[0][1] + point.z * matrix[0][2] + matrix[0][3];
    const y = point.x * matrix[1][0] + point.y * matrix[1][1] + point.z * matrix[1][2] + matrix[1][3];
    const z = point.x * matrix[2][0] + point.y * matrix[2][1] + point.z * matrix[2][2] + matrix[2][3];
    const w = point.x * matrix[3][0] + point.y * matrix[3][1] + point.z * matrix[3][2] + matrix[3][3];

    return new Point3D(x / w, y / w, z / w);
}

function createTranslationMatrix(dx, dy, dz) {
    return [
        [1, 0, 0, dx],
        [0, 1, 0, dy],
        [0, 0, 1, dz],
        [0, 0, 0, 1]
    ];
}

function createScaleMatrix(sx, sy, sz) {
    return [
        [sx, 0, 0, 0],
        [0, sy, 0, 0],
        [0, 0, sz, 0],
        [0, 0, 0, 1]
    ];
}

function createRotationXMatrix(angleInDegrees) {
    const rad = (angleInDegrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return [
        [1, 0, 0, 0],
        [0, cos, -sin, 0],
        [0, sin, cos, 0],
        [0, 0, 0, 1]
    ];
}

function createRotationYMatrix(angleInDegrees) {
    const rad = (angleInDegrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return [
        [cos, 0, sin, 0],
        [0, 1, 0, 0],
        [-sin, 0, cos, 0],
        [0, 0, 0, 1]
    ];
}

function createRotationZMatrix(angleInDegrees) {
    const rad = (angleInDegrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return [
        [cos, -sin, 0, 0],
        [sin, cos, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
}

function createScaleAroundPointMatrix(sx, sy, sz, cx, cy, cz) {
    const t1 = createTranslationMatrix(-cx, -cy, -cz);
    const s = createScaleMatrix(sx, sy, sz);
    const t2 = createTranslationMatrix(cx, cy, cz);

    return multiplyMatrices4(multiplyMatrices4(t2, s), t1);
}

function createRotationAroundCenterMatrix(angleX, angleY, angleZ, center) {
    const t1 = createTranslationMatrix(-center.x, -center.y, -center.z);

    let rotation = createIdentityMatrix();
    if (angleX !== 0) rotation = multiplyMatrices4(rotation, createRotationXMatrix(angleX));
    if (angleY !== 0) rotation = multiplyMatrices4(rotation, createRotationYMatrix(angleY));
    if (angleZ !== 0) rotation = multiplyMatrices4(rotation, createRotationZMatrix(angleZ));

    const t2 = createTranslationMatrix(center.x, center.y, center.z);

    return multiplyMatrices4(multiplyMatrices4(t2, rotation), t1);
}

function createRotationAroundLineMatrix(angle, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;

    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const lx = dx / length;
    const ly = dy / length;
    const lz = dz / length;

    const t1 = createTranslationMatrix(-p1.x, -p1.y, -p1.z);

    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const oneMinusCos = 1 - cos;

    const rotationMatrix = [
        [cos + lx * lx * oneMinusCos, lx * ly * oneMinusCos - lz * sin, lx * lz * oneMinusCos + ly * sin, 0],
        [ly * lx * oneMinusCos + lz * sin, cos + ly * ly * oneMinusCos, ly * lz * oneMinusCos - lx * sin, 0],
        [lz * lx * oneMinusCos - ly * sin, lz * ly * oneMinusCos + lx * sin, cos + lz * lz * oneMinusCos, 0],
        [0, 0, 0, 1]
    ];

    const t2 = createTranslationMatrix(p1.x, p1.y, p1.z);

    return multiplyMatrices4(multiplyMatrices4(t2, rotationMatrix), t1);
}

function createReflectionXYMatrix() {
    return [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, -1, 0],
        [0, 0, 0, 1]
    ];
}

function createReflectionXZMatrix() {
    return [
        [1, 0, 0, 0],
        [0, -1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
}

function createReflectionYZMatrix() {
    return [
        [-1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
}

// ========== Вычисление нормалей ==========

function computeFaceNormalRaw(face, vertices) {
    if (face.vertexIndices.length < 3) return { x: 0, y: 0, z: 1 };

    const v0 = vertices[face.vertexIndices[0]];
    const v1 = vertices[face.vertexIndices[1]];
    const v2 = vertices[face.vertexIndices[2]];

    const edge1 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z };
    const edge2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z };

    const nx = edge1.y * edge2.z - edge1.z * edge2.y;
    const ny = edge1.z * edge2.x - edge1.x * edge2.z;
    const nz = edge1.x * edge2.y - edge1.y * edge2.x;

    const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (length < 0.0001) return { x: 0, y: 0, z: 1 };

    return { x: nx / length, y: ny / length, z: nz / length };
}

function ensureNormalPointsOutward(normal, face, vertices, polyhedronCenter) {
    const faceCenter = getFaceCenter(face, vertices);

    const toFace = {
        x: faceCenter.x - polyhedronCenter.x,
        y: faceCenter.y - polyhedronCenter.y,
        z: faceCenter.z - polyhedronCenter.z
    };

    const lengthToFace = Math.sqrt(toFace.x * toFace.x + toFace.y * toFace.y + toFace.z * toFace.z);
    if (lengthToFace < 0.0001) {
        return normal;
    }

    const toFaceNorm = {
        x: toFace.x / lengthToFace,
        y: toFace.y / lengthToFace,
        z: toFace.z / lengthToFace
    };

    const dot = dotProduct(normal, toFaceNorm);

    if (dot < 0) {
        return { x: -normal.x, y: -normal.y, z: -normal.z };
    }

    return normal;
}

function computeAllFaceNormals(polyhedron) {
    const center = polyhedron.getCenter();
    return polyhedron.faces.map((face) => {
        const rawNormal = computeFaceNormalRaw(face, polyhedron.vertices);
        return ensureNormalPointsOutward(rawNormal, face, polyhedron.vertices, center);
    });
}

function getFaceCenter(face, vertices) {
    let sumX = 0,
        sumY = 0,
        sumZ = 0;
    for (const vIndex of face.vertexIndices) {
        sumX += vertices[vIndex].x;
        sumY += vertices[vIndex].y;
        sumZ += vertices[vIndex].z;
    }
    const count = face.vertexIndices.length;
    return { x: sumX / count, y: sumY / count, z: sumZ / count };
}

function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

function isFaceVisible(face, vertices, normal, viewDirection, projectionType, camera = null) {
    if (projectionType === ProjectionType.AXONOMETRIC) {
        return dotProduct(normal, viewDirection) > 0;
    } else if (projectionType === ProjectionType.CAMERA && camera) {
        // Для режима камеры: вектор от грани к камере
        const faceCenter = getFaceCenter(face, vertices);
        const toCameraVector = {
            x: camera.position.x - faceCenter.x,
            y: camera.position.y - faceCenter.y,
            z: camera.position.z - faceCenter.z
        };
        const length = Math.sqrt(toCameraVector.x ** 2 + toCameraVector.y ** 2 + toCameraVector.z ** 2);
        if (length < 0.0001) return true;

        const normalizedToCamera = {
            x: toCameraVector.x / length,
            y: toCameraVector.y / length,
            z: toCameraVector.z / length
        };

        return dotProduct(normal, normalizedToCamera) > 0;
    } else {
        // Для обычной перспективной проекции (фиксированная камера)
        const faceCenter = getFaceCenter(face, vertices);
        const toCameraVector = {
            x: -faceCenter.x,
            y: -faceCenter.y,
            z: 1000 - faceCenter.z
        };
        const length = Math.sqrt(toCameraVector.x ** 2 + toCameraVector.y ** 2 + toCameraVector.z ** 2);
        if (length < 0.0001) return true;

        const normalizedToCamera = {
            x: toCameraVector.x / length,
            y: toCameraVector.y / length,
            z: toCameraVector.z / length
        };

        return dotProduct(normal, normalizedToCamera) > 0;
    }
}

function getDefaultAxonometricViewDirection() {
    const x = 1,
        y = 1,
        z = 1;
    const length = Math.sqrt(x * x + y * y + z * z);
    return { x: x / length, y: y / length, z: z / length };
}

function getDefaultPerspectiveViewDirection() {
    return { x: 0, y: 0, z: 1 };
}
