//
// Генерация правильных многогранников
//

// В функции createTetrahedron заменим texCoords:
function createTetrahedron(size = 100) {
    const a = size;
    const h = a * Math.sqrt(2 / 3);
    const vertices = [
        new Point3D(0, (h * 2) / 3, 0),
        new Point3D(-a / 2, -h / 3, (a * Math.sqrt(3)) / 6),
        new Point3D(a / 2, -h / 3, (a * Math.sqrt(3)) / 6),
        new Point3D(0, -h / 3, (-a * Math.sqrt(3)) / 3)
    ];

    // Правильные UV-координаты для каждой вершины тетраэдра
    const texCoords = [
        new UV(0.5, 0.2),    // верхняя вершина
        new UV(0.1, 0.9),    // нижняя левая-задняя
        new UV(0.9, 0.9),    // нижняя правая-задняя
        new UV(0.5, 1.0)     // нижняя передняя
    ];

    const faces = [
        new Face([0, 1, 2], [0, 1, 2]),
        new Face([0, 2, 3], [0, 2, 3]),
        new Face([0, 3, 1], [0, 3, 1]),
        new Face([1, 3, 2], [1, 3, 2])
    ];

    return new Polyhedron(vertices, faces, null, null, texCoords);
}

function createHexahedron(size = 100) {
    const s = size / 2;
    const vertices = [
        new Point3D(-s, -s, -s),  // 0
        new Point3D(s, -s, -s),   // 1
        new Point3D(s, s, -s),    // 2
        new Point3D(-s, s, -s),   // 3
        new Point3D(-s, -s, s),   // 4
        new Point3D(s, -s, s),    // 5
        new Point3D(s, s, s),     // 6
        new Point3D(-s, s, s)     // 7
    ];

    // UV-координаты: каждая грань использует весь диапазон [0,1]
    // Создаем 24 UV-координаты (4 на каждую грань из 6 граней)
    const texCoords = [];

    // Для каждой грани создаем UV-координаты от (0,1) до (1,0)
    // Грань 0: Задняя (-Z)
    texCoords.push(new UV(0, 1));  // UV0
    texCoords.push(new UV(1, 1));  // UV1
    texCoords.push(new UV(1, 0));  // UV2
    texCoords.push(new UV(0, 0));  // UV3

    // Грань 1: Передняя (+Z)
    texCoords.push(new UV(0, 1));  // UV4
    texCoords.push(new UV(1, 1));  // UV5
    texCoords.push(new UV(1, 0));  // UV6
    texCoords.push(new UV(0, 0));  // UV7

    // Грань 2: Левая (-X)
    texCoords.push(new UV(0, 1));  // UV8
    texCoords.push(new UV(1, 1));  // UV9
    texCoords.push(new UV(1, 0));  // UV10
    texCoords.push(new UV(0, 0));  // UV11

    // Грань 3: Правая (+X)
    texCoords.push(new UV(0, 1));  // UV12
    texCoords.push(new UV(1, 1));  // UV13
    texCoords.push(new UV(1, 0));  // UV14
    texCoords.push(new UV(0, 0));  // UV15

    // Грань 4: Верхняя (+Y)
    texCoords.push(new UV(0, 1));  // UV16
    texCoords.push(new UV(1, 1));  // UV17
    texCoords.push(new UV(1, 0));  // UV18
    texCoords.push(new UV(0, 0));  // UV19

    // Грань 5: Нижняя (-Y)
    texCoords.push(new UV(0, 1));  // UV20
    texCoords.push(new UV(1, 1));  // UV21
    texCoords.push(new UV(1, 0));  // UV22
    texCoords.push(new UV(0, 0));  // UV23

    const faces = [
        // Задняя грань (-Z) - грань 0
        new Face([0, 1, 2, 3], [0, 1, 2, 3]),
        // Передняя грань (+Z) - грань 1
        new Face([4, 5, 6, 7], [4, 5, 6, 7]),
        // Левая грань (-X) - грань 2
        new Face([0, 3, 7, 4], [8, 9, 10, 11]),
        // Правая грань (+X) - грань 3
        new Face([1, 2, 6, 5], [12, 13, 14, 15]),
        // Верхняя грань (+Y) - грань 4
        new Face([3, 2, 6, 7], [16, 17, 18, 19]),
        // Нижняя грань (-Y) - грань 5
        new Face([0, 1, 5, 4], [20, 21, 22, 23])
    ];

    return new Polyhedron(vertices, faces, null, null, texCoords);
}

function createOctahedron(size = 100) {
    const s = size / Math.sqrt(2);
    const vertices = [
        new Point3D(0, s, 0),    // 0: верхняя вершина
        new Point3D(-s, 0, 0),   // 1: левая вершина
        new Point3D(0, 0, s),    // 2: передняя вершина
        new Point3D(s, 0, 0),    // 3: правая вершина
        new Point3D(0, 0, -s),   // 4: задняя вершина
        new Point3D(0, -s, 0)    // 5: нижняя вершина
    ];

    // Простые UV-координаты для каждой грани (полная текстура на каждую грань)
    const texCoords = [
        // Все грани используют одинаковые UV: (0,0), (1,0), (0,1)
        new UV(0, 0),  // UV0
        new UV(1, 0),  // UV1
        new UV(0, 1),  // UV2
        new UV(1, 1)   // UV3 (для полноты)
    ];

    const faces = [
        // Каждая грань использует разные комбинации UV-координат
        new Face([0, 2, 1], [0, 1, 2]),    // верхняя-передняя-левая
        new Face([0, 3, 2], [0, 1, 2]),    // верхняя-правая-передняя
        new Face([0, 4, 3], [0, 1, 2]),    // верхняя-задняя-правая
        new Face([0, 1, 4], [0, 1, 2]),    // верхняя-левая-задняя

        new Face([5, 1, 2], [2, 1, 0]),    // нижняя-левая-передняя (перевернуто)
        new Face([5, 2, 3], [2, 1, 0]),    // нижняя-передняя-правая (перевернуто)
        new Face([5, 3, 4], [2, 1, 0]),    // нижняя-правая-задняя (перевернуто)
        new Face([5, 4, 1], [2, 1, 0])     // нижняя-задняя-левая (перевернуто)
    ];

    return new Polyhedron(vertices, faces, null, null, texCoords);
}

function createIcosahedron(size = 100) {
    const phi = (1 + Math.sqrt(5)) / 2; // золотое сечение
    const a = size / (2 * Math.sin((2 * Math.PI) / 5));
    const b = a / phi;
    const vertices = [new Point3D(0, b, a), new Point3D(b, a, 0), new Point3D(-b, a, 0), new Point3D(0, b, -a), new Point3D(0, -b, a), new Point3D(-a, 0, b), new Point3D(0, -b, -a), new Point3D(a, 0, -b), new Point3D(a, 0, b), new Point3D(-a, 0, -b), new Point3D(b, -a, 0), new Point3D(-b, -a, 0)];
    const faces = [new Face([0, 1, 2]), new Face([1, 0, 8]), new Face([2, 1, 3]), new Face([3, 1, 7]), new Face([8, 0, 4]), new Face([0, 2, 5]), new Face([4, 0, 5]), new Face([7, 1, 8]), new Face([10, 8, 4]), new Face([11, 4, 5]), new Face([6, 7, 10]), new Face([9, 3, 6]), new Face([2, 3, 9]), new Face([5, 2, 9]), new Face([11, 5, 9]), new Face([10, 7, 8]), new Face([6, 3, 7]), new Face([9, 6, 11]), new Face([11, 6, 10]), new Face([4, 11, 10])];

    return new Polyhedron(vertices, faces);
}

function createDodecahedron(size = 100) {
    const phi = (1 + Math.sqrt(5)) / 2;
    const a = size / 2;
    const b = a / phi;
    const c = a * phi;
    const vertices = [new Point3D(a, a, a), new Point3D(a, a, -a), new Point3D(a, -a, a), new Point3D(a, -a, -a), new Point3D(-a, a, a), new Point3D(-a, a, -a), new Point3D(-a, -a, a), new Point3D(-a, -a, -a), new Point3D(0, b, c), new Point3D(0, b, -c), new Point3D(0, -b, c), new Point3D(0, -b, -c), new Point3D(b, c, 0), new Point3D(b, -c, 0), new Point3D(-b, c, 0), new Point3D(-b, -c, 0), new Point3D(c, 0, b), new Point3D(c, 0, -b), new Point3D(-c, 0, b), new Point3D(-c, 0, -b)];
    const faces = [new Face([0, 8, 10, 2, 16]), new Face([0, 16, 17, 1, 12]), new Face([0, 12, 14, 4, 8]), new Face([1, 9, 5, 14, 12]), new Face([1, 17, 3, 11, 9]), new Face([2, 10, 6, 15, 13]), new Face([2, 13, 3, 17, 16]), new Face([3, 13, 15, 7, 11]), new Face([4, 14, 5, 19, 18]), new Face([4, 18, 6, 10, 8]), new Face([5, 9, 11, 7, 19]), new Face([6, 18, 19, 7, 15])];

    return new Polyhedron(vertices, faces);
}

function createIntersectingCubes(size = 100) {
    const s = size / 2;
    const offset = size * 0.6;
    const vertices1 = [new Point3D(-s - offset, -s, -s + offset), new Point3D(s - offset, -s, -s + offset), new Point3D(s - offset, s, -s + offset), new Point3D(-s - offset, s, -s + offset), new Point3D(-s - offset, -s, s + offset), new Point3D(s - offset, -s, s + offset), new Point3D(s - offset, s, s + offset), new Point3D(-s - offset, s, s + offset)];
    const vertices2 = [new Point3D(-s + offset, -s, -s - offset), new Point3D(s + offset, -s, -s - offset), new Point3D(s + offset, s, -s - offset), new Point3D(-s + offset, s, -s - offset), new Point3D(-s + offset, -s, s - offset), new Point3D(s + offset, -s, s - offset), new Point3D(s + offset, s, s - offset), new Point3D(-s + offset, s, s - offset)];
    const vertices = [...vertices1, ...vertices2];
    const faces = [new Face([0, 1, 2, 3]), new Face([4, 5, 6, 7]), new Face([0, 1, 5, 4]), new Face([2, 3, 7, 6]), new Face([0, 3, 7, 4]), new Face([1, 2, 6, 5]), new Face([8, 9, 10, 11]), new Face([12, 13, 14, 15]), new Face([8, 9, 13, 12]), new Face([10, 11, 15, 14]), new Face([8, 11, 15, 12]), new Face([9, 10, 14, 13])];

    return new Polyhedron(vertices, faces);
}
