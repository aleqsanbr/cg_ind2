class OBJProcessor {
    static parseOBJ(text) {
        const vertices = [];
        const texcoords = [];
        const normals = [];
        const faces = [];
        const edges = [];
        const edgeSet = new Set();

        let name = 'Загруженная модель';
        let currentObject = name;
        let currentMaterial = null;

        const lines = text.split(/\r?\n/);
        for (let rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const parts = line.split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                // v x y z [w] [r g b] - мы возьмём x, y, z; если есть w - учтём как однородную координату
                if (parts.length >= 4) {
                    let x = parseFloat(parts[1]);
                    let y = parseFloat(parts[2]);
                    let z = parseFloat(parts[3]);
                    if (parts.length >= 5 && !isNaN(parseFloat(parts[4])) && parts.length === 5) {
                        const w = parseFloat(parts[4]);
                        if (w && w !== 1.0) {
                            x = x / w;
                            y = y / w;
                            z = z / w;
                        }
                    }
                    vertices.push(new Point3D(x, y, z));
                }
            } else if (type === 'vt') {
                // texture coordinate (u [v [w]])
                const u = parseFloat(parts[1]) || 0;
                const v = parts.length >= 3 ? parseFloat(parts[2]) : 0;
                texcoords.push([u, v]);
            } else if (type === 'vn') {
                // нормали
                const nx = parseFloat(parts[1]) || 0;
                const ny = parseFloat(parts[2]) || 0;
                const nz = parseFloat(parts[3]) || 0;
                normals.push([nx, ny, nz]);
            } else if (type === 'f') {
                // грани
                const vertexIndices = [];
                for (let i = 1; i < parts.length; i++) {
                    const vertexPart = parts[i];
                    if (!vertexPart) continue;
                    // v / vt / vn  OR v//vn OR v
                    const sub = vertexPart.split('/');
                    let vi = parseInt(sub[0], 10);
                    if (isNaN(vi)) continue;

                    // отрицательные индексы - с конца списка
                    if (vi < 0) {
                        vi = vertices.length + vi;
                    } else {
                        vi = vi - 1; // индексы начинаются с 1
                    }

                    if (vi < 0 || vi >= vertices.length) {
                        // некорректный индекс
                        continue;
                    }

                    vertexIndices.push(vi);
                }

                if (vertexIndices.length >= 3) {
                    faces.push(new Face(vertexIndices.slice(), { object: currentObject, material: currentMaterial }));

                    // Собираем рёбра
                    for (let i = 0; i < vertexIndices.length; i++) {
                        const a = vertexIndices[i];
                        const b = vertexIndices[(i + 1) % vertexIndices.length];
                        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
                        if (!edgeSet.has(key)) {
                            edgeSet.add(key);
                            edges.push([a, b]);
                        }
                    }
                }
            } else if (type === 'l') {
                // линия: l v1 v2 v3 ... (мы можем сохранить как набор рёбер)
                const idxs = [];
                for (let i = 1; i < parts.length; i++) {
                    let vi = parseInt(parts[i], 10);
                    if (isNaN(vi)) continue;
                    if (vi < 0) vi = vertices.length + vi;
                    else vi = vi - 1;
                    if (vi >= 0 && vi < vertices.length) idxs.push(vi);
                }
                for (let i = 0; i < idxs.length - 1; i++) {
                    const a = idxs[i],
                        b = idxs[i + 1];
                    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
                    if (!edgeSet.has(key)) {
                        edgeSet.add(key);
                        edges.push([a, b]);
                    }
                }
            } else if (type === 'o' || type === 'g') {
                if (parts.length > 1) {
                    currentObject = parts.slice(1).join(' ');
                    name = currentObject; // последняя встреченная метка станет именем
                }
            } else if (type === 'usemtl') {
                if (parts.length > 1) currentMaterial = parts.slice(1).join(' ');
            } else if (type === 'mtllib') {
                // можно хранить имя библиотеки материалов, но сейчас не используем
            } else if (type === 's') {
                // smoothing group — можно игнорировать
            } else {
                // остальное игнорируем (commented or unsupported)
            }
        }

        return new Polyhedron(vertices, faces, edges, name);
    }

    static serializeOBJ(polyhedron) {
        if (!polyhedron || !Array.isArray(polyhedron.vertices)) {
            throw new Error('Invalid polyhedron for OBJ export');
        }

        const lines = [];
        const time = new Date().toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });

        lines.push(`# Exported from editor ${time}`);
        lines.push(`# Vertices: ${polyhedron.vertices.length}`);
        lines.push(`# Faces: ${polyhedron.faces.length}`);
        lines.push(`o ${polyhedron.name || 'polyhedron'}`);
        lines.push('');

        // вершины
        for (const v of polyhedron.vertices) {
            const x = Number(v.x || 0);
            const y = Number(v.y || 0);
            const z = Number(v.z || 0);
            lines.push(`v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`);
        }
        lines.push('');

        // грани (индексы +1)
        for (const face of polyhedron.faces) {
            if (!face || !Array.isArray(face.vertexIndices)) continue;
            const idxs = face.vertexIndices.map((i) => Number(i) + 1);
            lines.push('f ' + idxs.join(' '));
        }

        return lines.join('\n') + '\n';
    }
}
