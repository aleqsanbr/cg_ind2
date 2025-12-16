class RevolutionGenerator {
    static generate(profilePoints, axis = 'Y', steps = 24) {
        if (!Array.isArray(profilePoints) || profilePoints.length < 2) {
            throw new Error('Ïðîôèëü äîëæåí ñîäåðæàòü ìèíèìóì 2 òî÷êè');
        }
        steps = Math.max(3, Math.floor(steps));

        const vertices = [];
        const faces = [];
        const edges = [];

        for (let i = 0; i < steps; i++) {
            const angle = (2 * Math.PI * i) / steps;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            for (let p = 0; p < profilePoints.length; p++) {
                const { r, t } = profilePoints[p];
                let x = 0,
                    y = 0,
                    z = 0;

                if (axis === 'Y') {
                    x = r * cosA;
                    z = r * sinA;
                    y = t;
                } else if (axis === 'X') {
                    y = r * cosA;
                    z = r * sinA;
                    x = t;
                } else {
                    x = r * cosA;
                    y = r * sinA;
                    z = t;
                }

                vertices.push(new Point3D(x, y, z));
            }
        }

        const ringSize = profilePoints.length;

        for (let i = 0; i < steps; i++) {
            const nextI = (i + 1) % steps;
            for (let j = 0; j < ringSize - 1; j++) {
                const a = i * ringSize + j;
                const b = nextI * ringSize + j;
                const c = nextI * ringSize + (j + 1);
                const d = i * ringSize + (j + 1);

                faces.push(new Face([a, b, c]));
                faces.push(new Face([a, c, d]));

                edges.push([a, b]);
                edges.push([b, c]);
                edges.push([c, d]);
                edges.push([d, a]);
            }
        }

        return new Polyhedron(vertices, faces, edges, 'Ôèãóðà âðàùåíèÿ');
    }

    static parseProfileText(text) {
        const lines = text
            .trim()
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

        const pts = [];
        for (const ln of lines) {
            const parts = ln.split(/[,\s]+/).filter((x) => x.length > 0);
            if (parts.length < 2) continue;

            const r = parseFloat(parts[0]);
            const t = parseFloat(parts[1]);

            if (isNaN(r) || isNaN(t)) continue;
            pts.push({ r: Math.abs(r), t });
        }

        return pts;
    }
}
