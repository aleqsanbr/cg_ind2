//
// Ray Tracer для Cornell Box
//

class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(v) {
        return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    sub(v) {
        return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    mul(t) {
        return new Vec3(this.x * t, this.y * t, this.z * t);
    }

    div(t) {
        return new Vec3(this.x / t, this.y / t, this.z / t);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    cross(v) {
        return new Vec3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    normalize() {
        const len = this.length();
        if (len < 0.0001) return new Vec3(0, 0, 0);
        return this.div(len);
    }

    reflect(normal) {
        return this.sub(normal.mul(2 * this.dot(normal)));
    }

    refract(normal, etaRatio) {
        const cosTheta = Math.min(-this.dot(normal), 1.0);
        const rOutPerp = this.add(normal.mul(cosTheta)).mul(etaRatio);
        const rOutParallel = normal.mul(-Math.sqrt(Math.abs(1.0 - rOutPerp.dot(rOutPerp))));
        return rOutPerp.add(rOutParallel);
    }

    clone() {
        return new Vec3(this.x, this.y, this.z);
    }
}

class Ray {
    constructor(origin, direction) {
        this.origin = origin;
        this.direction = direction.normalize();
    }

    at(t) {
        return this.origin.add(this.direction.mul(t));
    }
}

class RTMaterial {
    constructor(color, ambient = 0.1, diffuse = 0.7, specular = 0.2, shininess = 32, reflectivity = 0, transparency = 0, refractiveIndex = 1.5) {
        this.color = color; // Vec3 с компонентами 0-1
        this.ambient = ambient;
        this.diffuse = diffuse;
        this.specular = specular;
        this.shininess = shininess;
        this.reflectivity = reflectivity; // 0 - не зеркальный, 1 - полностью зеркальный
        this.transparency = transparency; // 0 - непрозрачный, 1 - полностью прозрачный
        this.refractiveIndex = refractiveIndex;
    }
}

class HitRecord {
    constructor() {
        this.t = Infinity;
        this.point = null;
        this.normal = null;
        this.material = null;
        this.frontFace = true;
    }

    setFaceNormal(ray, outwardNormal) {
        this.frontFace = ray.direction.dot(outwardNormal) < 0;
        this.normal = this.frontFace ? outwardNormal : outwardNormal.mul(-1);
    }
}

// Сфера
class Sphere {
    constructor(center, radius, material) {
        this.center = center;
        this.radius = radius;
        this.material = material;
    }

    hit(ray, tMin, tMax, rec) {
        const oc = ray.origin.sub(this.center);
        const a = ray.direction.dot(ray.direction);
        const halfB = oc.dot(ray.direction);
        const c = oc.dot(oc) - this.radius * this.radius;
        const discriminant = halfB * halfB - a * c;

        if (discriminant < 0) return false;

        const sqrtD = Math.sqrt(discriminant);
        let root = (-halfB - sqrtD) / a;

        if (root < tMin || root > tMax) {
            root = (-halfB + sqrtD) / a;
            if (root < tMin || root > tMax) {
                return false;
            }
        }

        rec.t = root;
        rec.point = ray.at(rec.t);
        const outwardNormal = rec.point.sub(this.center).div(this.radius);
        rec.setFaceNormal(ray, outwardNormal);
        rec.material = this.material;

        return true;
    }
}

// Axis-Aligned Box (куб/параллелепипед)
class Box {
    constructor(minPoint, maxPoint, material) {
        this.min = minPoint;
        this.max = maxPoint;
        this.material = material;
    }

    hit(ray, tMin, tMax, rec) {
        let tNear = tMin;
        let tFar = tMax;
        let hitNormal = new Vec3(0, 0, 0);
        let normalSign = 1;

        // Проверка по каждой оси
        for (let i = 0; i < 3; i++) {
            const axis = ['x', 'y', 'z'][i];
            const invD = 1.0 / ray.direction[axis];
            let t0 = (this.min[axis] - ray.origin[axis]) * invD;
            let t1 = (this.max[axis] - ray.origin[axis]) * invD;

            let sign = 1;
            if (invD < 0) {
                [t0, t1] = [t1, t0];
                sign = -1;
            }

            if (t0 > tNear) {
                tNear = t0;
                hitNormal = new Vec3(0, 0, 0);
                hitNormal[axis] = -sign;
            }
            if (t1 < tFar) {
                tFar = t1;
            }

            if (tFar < tNear) return false;
        }

        if (tNear < tMin || tNear > tMax) return false;

        rec.t = tNear;
        rec.point = ray.at(rec.t);
        rec.setFaceNormal(ray, hitNormal);
        rec.material = this.material;

        return true;
    }
}

// Плоскость (для стен комнаты)
class Plane {
    constructor(point, normal, material) {
        this.point = point;
        this.normal = normal.normalize();
        this.material = material;
    }

    hit(ray, tMin, tMax, rec) {
        const denom = ray.direction.dot(this.normal);
        if (Math.abs(denom) < 0.0001) return false;

        const t = this.point.sub(ray.origin).dot(this.normal) / denom;

        if (t < tMin || t > tMax) return false;

        rec.t = t;
        rec.point = ray.at(t);
        rec.setFaceNormal(ray, this.normal);
        rec.material = this.material;

        return true;
    }
}

// Квадрат (ограниченная плоскость для стен)
class Quad {
    constructor(corner, edge1, edge2, material) {
        this.corner = corner;
        this.edge1 = edge1;
        this.edge2 = edge2;
        this.normal = edge1.cross(edge2).normalize();
        this.material = material;

        // Предвычисляем для быстрой проверки попадания
        this.w = this.normal.div(this.normal.dot(this.normal));
        this.d = this.normal.dot(corner);
    }

    hit(ray, tMin, tMax, rec) {
        const denom = ray.direction.dot(this.normal);
        if (Math.abs(denom) < 0.0001) return false;

        const t = (this.d - this.normal.dot(ray.origin)) / denom;
        if (t < tMin || t > tMax) return false;

        const intersection = ray.at(t);
        const planarHitPt = intersection.sub(this.corner);

        // Проверяем, попала ли точка внутрь квадрата
        const alpha = planarHitPt.dot(this.edge1) / this.edge1.dot(this.edge1);
        const beta = planarHitPt.dot(this.edge2) / this.edge2.dot(this.edge2);

        if (alpha < 0 || alpha > 1 || beta < 0 || beta > 1) return false;

        rec.t = t;
        rec.point = intersection;
        rec.setFaceNormal(ray, this.normal);
        rec.material = this.material;

        return true;
    }
}

// Точечный источник света
class PointLight {
    constructor(position, color, intensity = 1.0) {
        this.position = position;
        this.color = color; // Vec3 с компонентами 0-1
        this.intensity = intensity;
    }
}

// Сцена
class Scene {
    constructor() {
        this.objects = [];
        this.lights = [];
        this.backgroundColor = new Vec3(0.05, 0.05, 0.1);
    }

    add(object) {
        this.objects.push(object);
    }

    addLight(light) {
        this.lights.push(light);
    }

    hit(ray, tMin, tMax) {
        const rec = new HitRecord();
        let hitAnything = false;
        let closestSoFar = tMax;

        for (const object of this.objects) {
            const tempRec = new HitRecord();
            if (object.hit(ray, tMin, closestSoFar, tempRec)) {
                hitAnything = true;
                closestSoFar = tempRec.t;
                rec.t = tempRec.t;
                rec.point = tempRec.point;
                rec.normal = tempRec.normal;
                rec.material = tempRec.material;
                rec.frontFace = tempRec.frontFace;
            }
        }

        return hitAnything ? rec : null;
    }
}

// Ray Tracer
class RayTracer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.maxDepth = 5;
        this.scene = new Scene();

        // Камера (смотрит в отрицательном направлении Z)
        this.cameraPos = new Vec3(0, 0, 600);
        this.fov = 40;
    }

    setMaxDepth(depth) {
        this.maxDepth = depth;
    }

    // Вычисление коэффициента Френеля для отражения/преломления
    schlick(cosine, refIdx) {
        let r0 = (1 - refIdx) / (1 + refIdx);
        r0 = r0 * r0;
        return r0 + (1 - r0) * Math.pow(1 - cosine, 5);
    }

    // Проверка тени
    isInShadow(point, light) {
        const toLight = light.position.sub(point);
        const distToLight = toLight.length();
        const shadowRay = new Ray(point.add(toLight.normalize().mul(0.001)), toLight.normalize());

        const hit = this.scene.hit(shadowRay, 0.001, distToLight - 0.001);

        // Если объект прозрачный, частично пропускаем свет
        if (hit && hit.material.transparency > 0) {
            return 1 - hit.material.transparency * 0.7;
        }

        return hit ? 1 : 0;
    }

    // Освещение по Фонгу
    shade(rec, ray) {
        const material = rec.material;
        let color = material.color.mul(material.ambient);

        for (const light of this.scene.lights) {
            const shadowFactor = this.isInShadow(rec.point, light);
            if (shadowFactor >= 1) continue;

            const lightDir = light.position.sub(rec.point).normalize();
            const viewDir = ray.origin.sub(rec.point).normalize();

            // Диффузное освещение
            const diff = Math.max(0, rec.normal.dot(lightDir));
            const diffuse = material.color.mul(material.diffuse * diff * light.intensity);

            // Зеркальное освещение (блик)
            const reflectDir = lightDir.mul(-1).reflect(rec.normal);
            const spec = Math.pow(Math.max(0, viewDir.dot(reflectDir)), material.shininess);
            const specular = light.color.mul(material.specular * spec * light.intensity);

            const contribution = diffuse.add(specular).mul(1 - shadowFactor);
            color = color.add(contribution);
        }

        return color;
    }

    // Основная функция трассировки луча
    trace(ray, depth) {
        if (depth <= 0) {
            return new Vec3(0, 0, 0);
        }

        const rec = this.scene.hit(ray, 0.001, Infinity);

        if (!rec) {
            return this.scene.backgroundColor;
        }

        const material = rec.material;
        let localColor = this.shade(rec, ray);

        // Отражение
        if (material.reflectivity > 0) {
            const reflectDir = ray.direction.reflect(rec.normal);
            const reflectRay = new Ray(rec.point.add(reflectDir.mul(0.001)), reflectDir);
            const reflectColor = this.trace(reflectRay, depth - 1);
            localColor = localColor.mul(1 - material.reflectivity).add(reflectColor.mul(material.reflectivity));
        }

        // Прозрачность/преломление
        if (material.transparency > 0) {
            const refractiveIndex = material.refractiveIndex;
            const etaRatio = rec.frontFace ? (1.0 / refractiveIndex) : refractiveIndex;

            const cosTheta = Math.min(-ray.direction.dot(rec.normal), 1.0);
            const sinTheta = Math.sqrt(1.0 - cosTheta * cosTheta);

            const cannotRefract = etaRatio * sinTheta > 1.0;
            const fresnel = this.schlick(cosTheta, etaRatio);

            let refractDir;
            if (cannotRefract || fresnel > 0.5) {
                // Полное внутреннее отражение
                refractDir = ray.direction.reflect(rec.normal);
            } else {
                refractDir = ray.direction.refract(rec.normal, etaRatio);
            }

            const refractRay = new Ray(rec.point.add(refractDir.mul(0.001)), refractDir);
            const refractColor = this.trace(refractRay, depth - 1);

            localColor = localColor.mul(1 - material.transparency).add(refractColor.mul(material.transparency));
        }

        return localColor;
    }

    // Рендеринг изображения
    render(ctx, onProgress = null) {
        const imageData = ctx.createImageData(this.width, this.height);
        const data = imageData.data;

        const aspectRatio = this.width / this.height;
        const scale = Math.tan((this.fov * Math.PI / 180) / 2);

        let pixelsRendered = 0;
        const totalPixels = this.width * this.height;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Преобразуем координаты пикселя в координаты луча
                const px = (2 * (x + 0.5) / this.width - 1) * aspectRatio * scale;
                const py = (1 - 2 * (y + 0.5) / this.height) * scale;

                const rayDir = new Vec3(px, py, -1).normalize();
                const ray = new Ray(this.cameraPos, rayDir);

                let color = this.trace(ray, this.maxDepth);

                // Тональная компрессия и гамма-коррекция
                color = new Vec3(
                    Math.pow(Math.min(1, color.x), 1/2.2),
                    Math.pow(Math.min(1, color.y), 1/2.2),
                    Math.pow(Math.min(1, color.z), 1/2.2)
                );

                const idx = (y * this.width + x) * 4;
                data[idx] = Math.floor(color.x * 255);
                data[idx + 1] = Math.floor(color.y * 255);
                data[idx + 2] = Math.floor(color.z * 255);
                data[idx + 3] = 255;

                pixelsRendered++;
            }

            // Обновляем прогресс каждые 10 строк
            if (onProgress && y % 10 === 0) {
                onProgress(pixelsRendered / totalPixels);
            }
        }

        ctx.putImageData(imageData, 0, 0);

        if (onProgress) {
            onProgress(1);
        }
    }

    // Асинхронный рендеринг для UI
    async renderAsync(ctx, onProgress = null) {
        const imageData = ctx.createImageData(this.width, this.height);
        const data = imageData.data;

        const aspectRatio = this.width / this.height;
        const scale = Math.tan((this.fov * Math.PI / 180) / 2);

        const totalPixels = this.width * this.height;
        const batchSize = this.width * 5; // 5 строк за раз

        for (let startY = 0; startY < this.height; startY += 5) {
            const endY = Math.min(startY + 5, this.height);

            for (let y = startY; y < endY; y++) {
                for (let x = 0; x < this.width; x++) {
                    const px = (2 * (x + 0.5) / this.width - 1) * aspectRatio * scale;
                    const py = (1 - 2 * (y + 0.5) / this.height) * scale;

                    const rayDir = new Vec3(px, py, -1).normalize();
                    const ray = new Ray(this.cameraPos, rayDir);

                    let color = this.trace(ray, this.maxDepth);

                    color = new Vec3(
                        Math.pow(Math.min(1, color.x), 1/2.2),
                        Math.pow(Math.min(1, color.y), 1/2.2),
                        Math.pow(Math.min(1, color.z), 1/2.2)
                    );

                    const idx = (y * this.width + x) * 4;
                    data[idx] = Math.floor(color.x * 255);
                    data[idx + 1] = Math.floor(color.y * 255);
                    data[idx + 2] = Math.floor(color.z * 255);
                    data[idx + 3] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);

            if (onProgress) {
                onProgress(endY / this.height);
            }

            // Даём браузеру обновить UI
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (onProgress) {
            onProgress(1);
        }
    }
}

// Создание сцены Cornell Box
function createCornellBoxScene(options = {}) {
    const scene = new Scene();
    const roomSize = 200;

    // Цвета стен
    const white = new Vec3(0.73, 0.73, 0.73);
    const red = new Vec3(0.65, 0.05, 0.05);
    const green = new Vec3(0.12, 0.45, 0.15);
    const blue = new Vec3(0.1, 0.2, 0.6);

    // Материалы стен
    const whiteMat = new RTMaterial(white, 0.1, 0.8, 0.1, 16);
    const redMat = new RTMaterial(red, 0.1, 0.8, 0.1, 16);
    const blueMat = new RTMaterial(blue, 0.1, 0.8, 0.1, 16);

    // Зеркальный материал для стены
    const mirrorMat = new RTMaterial(new Vec3(0.9, 0.9, 0.9), 0.05, 0.1, 0.8, 128, 0.9, 0, 1.5);

    // Определяем материал для каждой стены с учётом зеркальности
    const getMaterial = (wallName, defaultMat) => {
        if (options.mirrorWall === wallName) {
            return mirrorMat;
        }
        return defaultMat;
    };

    // Левая стена (красная, X = -roomSize)
    scene.add(new Quad(
        new Vec3(-roomSize, -roomSize, roomSize),
        new Vec3(0, 0, -2 * roomSize),
        new Vec3(0, 2 * roomSize, 0),
        getMaterial('left', redMat)
    ));

    // Правая стена (синяя, X = +roomSize)
    scene.add(new Quad(
        new Vec3(roomSize, -roomSize, -roomSize),
        new Vec3(0, 0, 2 * roomSize),
        new Vec3(0, 2 * roomSize, 0),
        getMaterial('right', blueMat)
    ));

    // Задняя стена (белая, Z = -roomSize)
    scene.add(new Quad(
        new Vec3(-roomSize, -roomSize, -roomSize),
        new Vec3(2 * roomSize, 0, 0),
        new Vec3(0, 2 * roomSize, 0),
        getMaterial('back', whiteMat)
    ));

    // Пол (белый, Y = -roomSize)
    scene.add(new Quad(
        new Vec3(-roomSize, -roomSize, -roomSize),
        new Vec3(2 * roomSize, 0, 0),
        new Vec3(0, 0, 2 * roomSize),
        getMaterial('floor', whiteMat)
    ));

    // Потолок (белый, Y = +roomSize)
    scene.add(new Quad(
        new Vec3(-roomSize, roomSize, -roomSize),
        new Vec3(2 * roomSize, 0, 0),
        new Vec3(0, 0, 2 * roomSize),
        getMaterial('ceiling', whiteMat)
    ));

    // Цвета объектов
    const yellowColor = new Vec3(0.8, 0.7, 0.2);
    const grayColor = new Vec3(0.5, 0.45, 0.4);
    const sphere1Color = new Vec3(0.7, 0.3, 0.3);
    const sphere2Color = new Vec3(0.3, 0.5, 0.7);

    // Создаём материалы для объектов
    const createObjectMaterial = (color, isMirror, isTransparent, refractiveIndex) => {
        if (isMirror && isTransparent) {
            // Если и зеркальный, и прозрачный - делаем частично то и другое
            return new RTMaterial(color, 0.05, 0.2, 0.8, 128, 0.4, 0.5, refractiveIndex);
        } else if (isMirror) {
            return new RTMaterial(color, 0.05, 0.1, 0.9, 256, 0.85, 0, 1.5);
        } else if (isTransparent) {
            return new RTMaterial(color, 0.02, 0.1, 0.5, 128, 0.1, 0.9, refractiveIndex);
        } else {
            return new RTMaterial(color, 0.1, 0.8, 0.2, 32, 0, 0, 1.5);
        }
    };

    // Куб (слева-спереди)
    const cubeMat = createObjectMaterial(
        yellowColor,
        options.cubeMirror || false,
        options.cubeTransparent || false,
        options.refractiveIndex || 1.5
    );
    const cubeSize = 60;
    scene.add(new Box(
        new Vec3(-120, -roomSize, -50),
        new Vec3(-120 + cubeSize, -roomSize + cubeSize, -50 + cubeSize),
        cubeMat
    ));

    // Высокий параллелепипед (справа-сзади)
    const boxMat = createObjectMaterial(
        grayColor,
        options.boxMirror || false,
        options.boxTransparent || false,
        options.refractiveIndex || 1.5
    );
    const boxWidth = 55;
    const boxHeight = 130;
    const boxDepth = 55;
    scene.add(new Box(
        new Vec3(30, -roomSize, -120),
        new Vec3(30 + boxWidth, -roomSize + boxHeight, -120 + boxDepth),
        boxMat
    ));

    // Сфера 1 (на кубе)
    const sphere1Mat = createObjectMaterial(
        sphere1Color,
        options.sphere1Mirror || false,
        options.sphere1Transparent || false,
        options.refractiveIndex || 1.5
    );
    scene.add(new Sphere(
        new Vec3(-90, -roomSize + cubeSize + 35, -20),
        35,
        sphere1Mat
    ));

    // Сфера 2 (на полу справа)
    const sphere2Mat = createObjectMaterial(
        sphere2Color,
        options.sphere2Mirror || false,
        options.sphere2Transparent || false,
        options.refractiveIndex || 1.5
    );
    scene.add(new Sphere(
        new Vec3(100, -roomSize + 40, 50),
        40,
        sphere2Mat
    ));

    // Основной источник света (на потолке)
    const light1Pos = options.light1Pos || new Vec3(0, roomSize - 10, 0);
    const light1Intensity = options.light1Intensity !== undefined ? options.light1Intensity : 1.0;
    scene.addLight(new PointLight(
        light1Pos,
        new Vec3(1, 1, 1),
        light1Intensity
    ));

    // Дополнительный источник света
    if (options.enableLight2) {
        const light2Pos = options.light2Pos || new Vec3(150, 100, 150);
        const light2Intensity = options.light2Intensity !== undefined ? options.light2Intensity : 0.5;
        scene.addLight(new PointLight(
            light2Pos,
            new Vec3(1, 0.95, 0.9),
            light2Intensity
        ));
    }

    return scene;
}
