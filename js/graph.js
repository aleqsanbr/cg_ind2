// Функции для построения графиков поверхностей
class GraphGenerator {
    static generateSurface(customFunction, xMin, xMax, yMin, yMax, subdivisions) {
        const vertices = [];
        const faces = [];
        const edges = [];

        const xStep = (xMax - xMin) / subdivisions;
        const yStep = (yMax - yMin) / subdivisions;

        // Создаем вершины
        for (let i = 0; i <= subdivisions; i++) {
            for (let j = 0; j <= subdivisions; j++) {
                const x = xMin + i * xStep;
                const y = yMin + j * yStep;
                const z = this.calculateZ(customFunction, x, y);

                vertices.push(new Point3D(x, y, z));
            }
        }

        // Создаем грани (квадраты из двух треугольников)
        for (let i = 0; i < subdivisions; i++) {
            for (let j = 0; j < subdivisions; j++) {
                const v1 = i * (subdivisions + 1) + j;
                const v2 = v1 + 1;
                const v3 = (i + 1) * (subdivisions + 1) + j + 1;
                const v4 = (i + 1) * (subdivisions + 1) + j;

                // Два треугольника для одного квадрата
                faces.push(new Face([v1, v2, v3]));
                faces.push(new Face([v1, v3, v4]));

                // Добавляем рёбра
                edges.push([v1, v2]);
                edges.push([v2, v3]);
                edges.push([v3, v4]);
                edges.push([v4, v1]);
            }
        }

        return new Polyhedron(vertices, faces, edges, 'График функции');
    }

    static calculateZ(customFunction, x, y) {
        try {
            const func = new Function('x', 'y', `return ${customFunction}`);
            return func(x, y);
        } catch (error) {
            console.error('Ошибка вычисления функции:', error);
            return 0;
        }
    }
}
