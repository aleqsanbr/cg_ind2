//
// Система освещения и шейдинга
//

/**
 * Класс для представления источника света
 */
class Light {
    constructor(position, color = { r: 255, g: 255, b: 255 }, intensity = 1.0) {
        this.position = position; // Point3D
        this.color = color; // {r, g, b} в диапазоне [0, 255]
        this.intensity = intensity; // Интенсивность [0, 1]
    }
}

/**
 * Класс для представления материала объекта
 */
class Material {
    constructor(color = { r: 100, g: 150, b: 255 }, ambient = 0.1, diffuse = 0.7, specular = 0.3, shininess = 32) {
        this.color = color; // {r, g, b} в диапазоне [0, 255]
        this.ambient = ambient; // Коэффициент фонового освещения
        this.diffuse = diffuse; // Коэффициент диффузного отражения
        this.specular = specular; // Коэффициент зеркального отражения
        this.shininess = shininess; // Показатель блеска (для модели Фонга)
    }
}

/**
 * Вычисляет нормали к вершинам многогранника
 * Нормаль вершины = среднее нормалей всех граней, которым принадлежит вершина
 * @param {Polyhedron} polyhedron
 * @param {Array} faceNormals - массив нормалей граней (уже вычисленных)
 * @returns {Array} массив нормалей для каждой вершины
 */
function computeVertexNormals(polyhedron, faceNormals) {
    const vertexNormals = new Array(polyhedron.vertices.length).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
    const vertexFaceCount = new Array(polyhedron.vertices.length).fill(0);

    // Для каждой грани добавляем её нормаль к нормалям её вершин
    polyhedron.faces.forEach((face, faceIndex) => {
        const faceNormal = faceNormals[faceIndex];

        face.vertexIndices.forEach((vIndex) => {
            vertexNormals[vIndex].x += faceNormal.x;
            vertexNormals[vIndex].y += faceNormal.y;
            vertexNormals[vIndex].z += faceNormal.z;
            vertexFaceCount[vIndex]++;
        });
    });

    // Нормализуем нормали вершин (усредняем и приводим к единичной длине)
    vertexNormals.forEach((normal, index) => {
        if (vertexFaceCount[index] > 0) {
            normal.x /= vertexFaceCount[index];
            normal.y /= vertexFaceCount[index];
            normal.z /= vertexFaceCount[index];

            // Нормализация
            const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
            if (length > 0.0001) {
                normal.x /= length;
                normal.y /= length;
                normal.z /= length;
            }
        }
    });

    return vertexNormals;
}

/**
 * Модель освещения Ламберта (диффузное отражение)
 * Вычисляет цвет точки на основе диффузного освещения
 * @param {Object} normal - нормаль к поверхности {x, y, z}
 * @param {Point3D} position - позиция точки в 3D пространстве
 * @param {Light} light - источник света
 * @param {Material} material - материал поверхности
 * @returns {Object} цвет {r, g, b}
 */
function lambertShading(normal, position, light, material) {
    // Вектор от точки к источнику света
    const lightDir = {
        x: light.position.x - position.x,
        y: light.position.y - position.y,
        z: light.position.z - position.z
    };

    // Нормализация вектора к источнику света
    const lightDirLength = Math.sqrt(lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z);
    if (lightDirLength < 0.0001) {
        return { r: 0, g: 0, b: 0 };
    }

    lightDir.x /= lightDirLength;
    lightDir.y /= lightDirLength;
    lightDir.z /= lightDirLength;

    // Скалярное произведение нормали и направления на источник света
    const diffuseFactor = Math.max(0, dotProduct(normal, lightDir));

    // Фоновое освещение (ambient)
    const ambientR = material.color.r * material.ambient;
    const ambientG = material.color.g * material.ambient;
    const ambientB = material.color.b * material.ambient;

    // Диффузное освещение
    const diffuseR = material.color.r * material.diffuse * diffuseFactor * light.intensity;
    const diffuseG = material.color.g * material.diffuse * diffuseFactor * light.intensity;
    const diffuseB = material.color.b * material.diffuse * diffuseFactor * light.intensity;

    // Итоговый цвет
    return {
        r: Math.min(255, ambientR + diffuseR),
        g: Math.min(255, ambientG + diffuseG),
        b: Math.min(255, ambientB + diffuseB)
    };
}

/**
 * Модель освещения Фонга (фоновое + диффузное + зеркальное)
 * @param {Object} normal - нормаль к поверхности {x, y, z}
 * @param {Point3D} position - позиция точки в 3D пространстве
 * @param {Light} light - источник света
 * @param {Material} material - материал поверхности
 * @param {Point3D} viewPosition - позиция наблюдателя (камеры)
 * @returns {Object} цвет {r, g, b}
 */
function phongShading(normal, position, light, material, viewPosition) {
    // Вектор от точки к источнику света
    const lightDir = {
        x: light.position.x - position.x,
        y: light.position.y - position.y,
        z: light.position.z - position.z
    };

    // Нормализация вектора к источнику света
    const lightDirLength = Math.sqrt(lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z);
    if (lightDirLength < 0.0001) {
        return { r: 0, g: 0, b: 0 };
    }

    lightDir.x /= lightDirLength;
    lightDir.y /= lightDirLength;
    lightDir.z /= lightDirLength;

    // Вектор от точки к наблюдателю
    const viewDir = {
        x: viewPosition.x - position.x,
        y: viewPosition.y - position.y,
        z: viewPosition.z - position.z
    };

    // Нормализация вектора к наблюдателю
    const viewDirLength = Math.sqrt(viewDir.x * viewDir.x + viewDir.y * viewDir.y + viewDir.z * viewDir.z);
    if (viewDirLength < 0.0001) {
        return { r: 0, g: 0, b: 0 };
    }

    viewDir.x /= viewDirLength;
    viewDir.y /= viewDirLength;
    viewDir.z /= viewDirLength;

    // Вычисление отраженного вектора (R = 2*(N·L)*N - L)
    const dotNL = Math.max(0, dotProduct(normal, lightDir));
    const reflectDir = {
        x: 2 * dotNL * normal.x - lightDir.x,
        y: 2 * dotNL * normal.y - lightDir.y,
        z: 2 * dotNL * normal.z - lightDir.z
    };

    // Нормализация отраженного вектора
    const reflectLength = Math.sqrt(reflectDir.x * reflectDir.x + reflectDir.y * reflectDir.y + reflectDir.z * reflectDir.z);
    if (reflectLength > 0.0001) {
        reflectDir.x /= reflectLength;
        reflectDir.y /= reflectLength;
        reflectDir.z /= reflectLength;
    }

    // Вычисление компонентов освещения
    const ambient = material.ambient;
    const diffuse = material.diffuse * dotNL;

    // Зеркальная составляющая (R·V)^shininess
    const specularDot = Math.max(0, dotProduct(reflectDir, viewDir));
    const specular = material.specular * Math.pow(specularDot, material.shininess);

    // Итоговый коэффициент освещения
    const intensity = light.intensity * (ambient + diffuse + specular);

    // Применяем к цвету материала
    return {
        r: Math.min(255, material.color.r * intensity),
        g: Math.min(255, material.color.g * intensity),
        b: Math.min(255, material.color.b * intensity)
    };
}

/**
 * Модель Фонга + Туншейдинг (квантование освещения Фонга)
 * Сначала вычисляется освещение по Фонгу, затем результат квантуется
 * @param {Object} normal - нормаль к поверхности {x, y, z}
 * @param {Point3D} position - позиция точки в 3D пространстве
 * @param {Light} light - источник света
 * @param {Material} material - материал поверхности
 * @param {Point3D} viewPosition - позиция наблюдателя (камеры)
 * @param {number} levels - количество уровней яркости (обычно 3-5)
 * @returns {Object} цвет {r, g, b}
 */
function phongToonShading(normal, position, light, material, viewPosition, levels = 10) {
    // Сначала вычисляем цвет по модели Фонга
    const phongColor = phongShading(normal, position, light, material, viewPosition);

    // Конвертируем цвет в яркость (luminance)
    const luminance = 0.299 * phongColor.r + 0.587 * phongColor.g + 0.114 * phongColor.b;
    const maxLuminance = 255; // максимальная яркость

    // Квантование яркости
    const quantizedLuminance = Math.floor(luminance / maxLuminance * levels) / levels * maxLuminance;

    // Масштабируем цвет для сохранения оттенков
    const scale = quantizedLuminance / (luminance > 0 ? luminance : 1);

    return {
        r: Math.min(255, phongColor.r * scale),
        g: Math.min(255, phongColor.g * scale),
        b: Math.min(255, phongColor.b * scale)
    };
}

/**
 * Билинейная интерполяция цвета внутри треугольника
 * Используется для шейдинга Гуро
 * @param {Object} v0, v1, v2 - вершины треугольника {x, y} в экранных координатах
 * @param {Object} c0, c1, c2 - цвета в вершинах {r, g, b}
 * @param {number} px, py - координаты точки для интерполяции
 * @returns {Object} интерполированный цвет {r, g, b}
 */
function interpolateColorInTriangle(v0, v1, v2, c0, c1, c2, px, py) {
    // Барицентрические координаты
    const denom = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);

    if (Math.abs(denom) < 0.0001) {
        // Вырожденный треугольник
        return { r: c0.r, g: c0.g, b: c0.b };
    }

    const w0 = ((v1.y - v2.y) * (px - v2.x) + (v2.x - v1.x) * (py - v2.y)) / denom;
    const w1 = ((v2.y - v0.y) * (px - v2.x) + (v0.x - v2.x) * (py - v2.y)) / denom;
    const w2 = 1 - w0 - w1;

    return {
        r: w0 * c0.r + w1 * c1.r + w2 * c2.r,
        g: w0 * c0.g + w1 * c1.g + w2 * c2.g,
        b: w0 * c0.b + w1 * c1.b + w2 * c2.b
    };
}

/**
 * Билинейная интерполяция нормалей внутри треугольника
 * Используется для шейдинга Фонга
 * @param {Object} v0, v1, v2 - вершины треугольника {x, y} в экранных координатах
 * @param {Object} n0, n1, n2 - нормали в вершинах {x, y, z}
 * @param {number} px, py - координаты точки для интерполяции
 * @returns {Object} интерполированная нормаль {x, y, z}
 */
function interpolateNormalInTriangle(v0, v1, v2, n0, n1, n2, px, py) {
    // Барицентрические координаты
    const denom = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);

    if (Math.abs(denom) < 0.0001) {
        return { x: n0.x, y: n0.y, z: n0.z };
    }

    const w0 = ((v1.y - v2.y) * (px - v2.x) + (v2.x - v1.x) * (py - v2.y)) / denom;
    const w1 = ((v2.y - v0.y) * (px - v2.x) + (v0.x - v2.x) * (py - v2.y)) / denom;
    const w2 = 1 - w0 - w1;

    const normal = {
        x: w0 * n0.x + w1 * n1.x + w2 * n2.x,
        y: w0 * n0.y + w1 * n1.y + w2 * n2.y,
        z: w0 * n0.z + w1 * n1.z + w2 * n2.z
    };

    // Нормализация интерполированной нормали
    const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    if (length > 0.0001) {
        normal.x /= length;
        normal.y /= length;
        normal.z /= length;
    }

    return normal;
}

/**
 * Интерполяция 3D позиции внутри треугольника
 * Используется для получения 3D координат пикселя
 * @param {Object} v0, v1, v2 - вершины треугольника {x, y} в экранных координатах
 * @param {Point3D} p0, p1, p2 - 3D позиции вершин
 * @param {number} px, py - координаты точки для интерполяции
 * @returns {Point3D} интерполированная 3D позиция
 */
function interpolatePositionInTriangle(v0, v1, v2, p0, p1, p2, px, py) {
    const denom = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);

    if (Math.abs(denom) < 0.0001) {
        return p0.clone();
    }

    const w0 = ((v1.y - v2.y) * (px - v2.x) + (v2.x - v1.x) * (py - v2.y)) / denom;
    const w1 = ((v2.y - v0.y) * (px - v2.x) + (v0.x - v2.x) * (py - v2.y)) / denom;
    const w2 = 1 - w0 - w1;

    return new Point3D(w0 * p0.x + w1 * p1.x + w2 * p2.x, w0 * p0.y + w1 * p1.y + w2 * p2.y, w0 * p0.z + w1 * p1.z + w2 * p2.z);
}

function colorToCSS(color) {
    return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
}

function roundToUnit(value) {
    if (Math.abs(value - 1) < 0.01) return 1;
    if (Math.abs(value + 1) < 0.01) return -1;
    if (Math.abs(value) < 0.01) return 0;
    return value;
}
