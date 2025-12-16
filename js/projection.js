//
// Проекции и камера
//

const ProjectionType = {
    PERSPECTIVE: 'perspective',
    AXONOMETRIC: 'axonometric',
    CAMERA: 'camera'
};

class Camera {
    constructor(position = new Point3D(0, 0, 1000), yaw = 0, pitch = 0) {
        this.position = position;
        this.yaw = yaw; // Поворот вокруг вертикальной оси
        this.pitch = pitch; // Поворот вокруг горизонтальной оси
        this.up = new Point3D(0, 1, 0);
        this.moveSpeed = 10;
        this.mouseSensitivity = 0.2;
        this.fov = 60; // Field of view в градусах
        this.near = 0.1; // Ближняя плоскость отсечения
        this.far = 10000; // Дальняя плоскость отсечения
    }

    worldToView(point) {
        // Перенос в систему координат камеры
        const translated = {
            x: point.x - this.position.x,
            y: point.y - this.position.y,
            z: point.z - this.position.z
        };

        // Поворот согласно углам камеры
        const radYaw = this.yaw * Math.PI / 180;
        const radPitch = this.pitch * Math.PI / 180;

        // Поворот вокруг Y (yaw)
        const cosYaw = Math.cos(radYaw);
        const sinYaw = Math.sin(radYaw);
        const rotatedYaw = {
            x: translated.x * cosYaw - translated.z * sinYaw,
            y: translated.y,
            z: translated.x * sinYaw + translated.z * cosYaw
        };

        // Поворот вокруг X (pitch)
        const cosPitch = Math.cos(radPitch);
        const sinPitch = Math.sin(radPitch);
        const rotatedPitch = {
            x: rotatedYaw.x,
            y: rotatedYaw.y * cosPitch + rotatedYaw.z * sinPitch,
            z: -rotatedYaw.y * sinPitch + rotatedYaw.z * cosPitch
        };

        return new Point3D(rotatedPitch.x, rotatedPitch.y, rotatedPitch.z);
    }

    // Получить направление взгляда камеры
    getForward() {
        const yawRad = (this.yaw * Math.PI) / 180;
        const pitchRad = (this.pitch * Math.PI) / 180;

        return {
            x: Math.sin(yawRad) * Math.cos(pitchRad),
            y: -Math.sin(pitchRad),
            z: -Math.cos(yawRad) * Math.cos(pitchRad)
        };
    }

    // Получить вектор "вправо" от камеры
    getRight() {
        const yawRad = (this.yaw * Math.PI) / 180;

        return {
            x: Math.cos(yawRad),
            y: 0,
            z: Math.sin(yawRad)
        };
    }

    // Получить вектор "вверх" относительно камеры
    getUp() {
        const forward = this.getForward();
        const right = this.getRight();

        // up = right * forward (векторное произведение)
        return {
            x: right.y * forward.z - right.z * forward.y,
            y: right.z * forward.x - right.x * forward.z,
            z: right.x * forward.y - right.y * forward.x
        };
    }

    moveForward(amount) {
        const forward = this.getForward();
        this.position.x += forward.x * amount;
        this.position.y += forward.y * amount;
        this.position.z += forward.z * amount;
    }

    moveRight(amount) {
        const right = this.getRight();
        this.position.x += right.x * amount;
        this.position.y += right.y * amount;
        this.position.z += right.z * amount;
    }

    moveUp(amount) {
        this.position.y += amount;
    }

    rotate(deltaYaw, deltaPitch) {
        this.yaw += deltaYaw;
        this.pitch += deltaPitch;

        // Ограничиваем pitch, чтобы не переворачиваться
        this.pitch = Math.max(-89, Math.min(89, this.pitch));
    }

    // Создает View Matrix, преобразует мировые координаты в координаты камеры
    getViewMatrix() {
        const forward = this.getForward();
        const right = this.getRight();
        const up = this.getUp();

        const viewMatrix = [
            [right.x, right.y, right.z, -(right.x * this.position.x + right.y * this.position.y + right.z * this.position.z)],
            [up.x, up.y, up.z, -(up.x * this.position.x + up.y * this.position.y + up.z * this.position.z)],
            [-forward.x, -forward.y, -forward.z, -(-forward.x * this.position.x + -forward.y * this.position.y + -forward.z * this.position.z)],
            [0, 0, 0, 1]
        ];

        return viewMatrix;
    }

    // Создает матрицу перспективной проекции
    getProjectionMatrix(aspectRatio) {
        const fovRad = (this.fov * Math.PI) / 180;
        const f = 1.0 / Math.tan(fovRad / 2);
        const rangeInv = 1.0 / (this.near - this.far);

        return [
            [f / aspectRatio, 0, 0, 0],
            [0, f, 0, 0],
            [0, 0, (this.near + this.far) * rangeInv, 2 * this.near * this.far * rangeInv],
            [0, 0, -1, 0]
        ];
    }
}

class Projection {
    constructor(type = ProjectionType.PERSPECTIVE) {
        this.type = type;
        this.distance = 1000;
        this.camera = new Camera();
    }

    project(point3D, canvasWidth, canvasHeight) {
        if (this.type === ProjectionType.PERSPECTIVE) {
            return this.perspectiveProject(point3D, canvasWidth, canvasHeight);
        } else if (this.type === ProjectionType.CAMERA) {
            return this.cameraProject(point3D, canvasWidth, canvasHeight);
        } else {
            return this.axonometricProject(point3D, canvasWidth, canvasHeight);
        }
    }

    cameraProject(point3D, canvasWidth, canvasHeight) {
        // world space -> camera space
        const viewMatrix = this.camera.getViewMatrix();
        const viewPoint = applyMatrix4(point3D, viewMatrix);

        // Проверка: если точка за камерой, возвращаем координаты за пределами экрана
        if (viewPoint.z > -this.camera.near) {
            return { x: -10000, y: -10000, depth: viewPoint.z };
        }

        // camera space -> clip space
        const aspectRatio = canvasWidth / canvasHeight;
        const projectionMatrix = this.camera.getProjectionMatrix(aspectRatio);
        const clipPoint = applyMatrix4(viewPoint, projectionMatrix);

        // -> canvas
        const x2D = (clipPoint.x + 1) * 0.5 * canvasWidth;
        const y2D = (1 - clipPoint.y) * 0.5 * canvasHeight;

        return { x: x2D, y: y2D, depth: viewPoint.z };
    }

    perspectiveProject(point3D, canvasWidth, canvasHeight) {
        const factor = this.distance / (this.distance - point3D.z);
        const x2D = point3D.x * factor + canvasWidth / 2;
        const y2D = -point3D.y * factor + canvasHeight / 2;

        // Вычисляем расстояние от точки наблюдения (0, 0, distance) до точки
        const dx = point3D.x;
        const dy = point3D.y;
        const dz = point3D.z - this.distance;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        return { x: x2D, y: y2D, depth: distance };
    }

    axonometricProject(point3D, canvasWidth, canvasHeight) {
        const angleX = Math.PI / 6;
        const angleZ = Math.PI / 6;
        const x2D = point3D.x * Math.cos(angleX) - point3D.z * Math.cos(angleZ) + canvasWidth / 2;
        const y2D = -point3D.y + point3D.x * Math.sin(angleX) + point3D.z * Math.sin(angleZ) + canvasHeight / 2;

        // Для аксонометрии используем расстояние от точки наблюдения
        // Направление взгляда примерно (1, -1, -1) нормализованное
        const viewDirX = 1 / Math.sqrt(3);
        const viewDirY = -1 / Math.sqrt(3);
        const viewDirZ = -1 / Math.sqrt(3);

        // Проецируем точку на направление взгляда
        const depth = -(point3D.x * viewDirX + point3D.y * viewDirY + point3D.z * viewDirZ);

        return { x: x2D, y: y2D, depth: depth };
    }

    setType(type) {
        this.type = type;
    }
}

function projectPolyhedron(polyhedron, projection, canvasWidth, canvasHeight) {
    const projectedVertices = polyhedron.vertices.map((v) => projection.project(v, canvasWidth, canvasHeight));

    return {
        vertices: projectedVertices,
        faces: polyhedron.faces,
        edges: polyhedron.getEdges()
    };
}
