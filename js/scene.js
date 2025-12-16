//
// Сцена и создание Cornell Box
//

class Scene {
  constructor() {
    this.objects = [];
    this.lights = [];
    this.backgroundColor = { r: 0.05, g: 0.05, b: 0.1 };
    this.ambientLight = { r: 0.1, g: 0.1, b: 0.1 }; // Ambient освещение
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
        rec.point = tempRec.point.clone();
        rec.normal = tempRec.normal.clone();
        rec.material = tempRec.material;
        rec.frontFace = tempRec.frontFace;
      }
    }

    return hitAnything ? rec : null;
  }
}

// Создание сцены Cornell Box
function createCornellBoxScene(options = {}) {
  const scene = new Scene();
  const roomSize = 200;

  // Материалы стен (увеличиваем ambient для лучшего освещения)
  const whiteMat = new RTMaterial({ r: 0.73, g: 0.73, b: 0.73 }, 0.2, 0.7, 0.1, 16);
  const redMat = new RTMaterial({ r: 0.65, g: 0.05, b: 0.05 }, 0.2, 0.7, 0.1, 16);
  const blueMat = new RTMaterial({ r: 0.1, g: 0.2, b: 0.6 }, 0.2, 0.7, 0.1, 16);
  const greenMat = new RTMaterial({ r: 0.12, g: 0.45, b: 0.15 }, 0.2, 0.7, 0.1, 16);

  // Зеркальный материал для стены
  const mirrorMat = new RTMaterial({ r: 0.9, g: 0.9, b: 0.9 }, 0.05, 0.1, 0.8, 128, 0.9, 0, 1.5);

  const getMaterial = (wallName, defaultMat) => {
    return options.mirrorWall === wallName ? mirrorMat : defaultMat;
  };

  // Левая стена (красная, X = -roomSize)
  scene.add(new Quad(new Point3D(-roomSize, -roomSize, roomSize), new Point3D(0, 0, -2 * roomSize), new Point3D(0, 2 * roomSize, 0), getMaterial('left', redMat)));

  // Правая стена (синяя, X = +roomSize)
  scene.add(new Quad(new Point3D(roomSize, -roomSize, -roomSize), new Point3D(0, 0, 2 * roomSize), new Point3D(0, 2 * roomSize, 0), getMaterial('right', blueMat)));

  // Задняя стена (белая, Z = -roomSize)
  scene.add(new Quad(new Point3D(-roomSize, -roomSize, -roomSize), new Point3D(2 * roomSize, 0, 0), new Point3D(0, 2 * roomSize, 0), getMaterial('back', whiteMat)));

  // Пол (белый, Y = -roomSize)
  scene.add(new Quad(new Point3D(-roomSize, -roomSize, -roomSize), new Point3D(2 * roomSize, 0, 0), new Point3D(0, 0, 2 * roomSize), getMaterial('floor', whiteMat)));

  // Потолок (белый, Y = +roomSize)
  scene.add(new Quad(new Point3D(-roomSize, roomSize, -roomSize), new Point3D(2 * roomSize, 0, 0), new Point3D(0, 0, 2 * roomSize), getMaterial('ceiling', whiteMat)));

  // Цвета объектов
  const yellowColor = { r: 0.9, g: 0.75, b: 0.0 };
  const grayColor = { r: 0.4, g: 0.35, b: 0.3 };
  const sphere1Color = { r: 0.8, g: 0.0, b: 0.0 };
  const sphere2Color = { r: 0.0, g: 0.2, b: 0.8 };

  const createObjectMaterial = (color, isMirror, isTransparent, refractiveIndex) => {
    if (isMirror && isTransparent) {
      return new RTMaterial(color, 0.05, 0.2, 0.8, 128, 0.4, 0.5, refractiveIndex);
    } else if (isMirror) {
      return new RTMaterial(color, 0.05, 0.1, 0.9, 256, 0.85, 0, 1.5);
    } else if (isTransparent) {
      return new RTMaterial(color, 0.02, 0.1, 0.5, 128, 0.1, 0.9, refractiveIndex);
    } else {
      return new RTMaterial(color, 0.15, 0.7, 0.3, 32, 0, 0, 1.5);
    }
  };

  // Куб (слева-спереди)
  const cubeMat = createObjectMaterial(yellowColor, options.cubeMirror || false, options.cubeTransparent || false, options.refractiveIndex || 1.5);
  const cubeSize = 80;
  scene.add(new Box(new Point3D(-120, -roomSize, -50), new Point3D(-120 + cubeSize, -roomSize + cubeSize, -50 + cubeSize), cubeMat));

  // Высокий параллелепипед (справа-сзади)
  const boxMat = createObjectMaterial(grayColor, options.boxMirror || false, options.boxTransparent || false, options.refractiveIndex || 1.5);
  const boxWidth = 70;
  const boxHeight = 300;
  const boxDepth = 70;
  scene.add(new Box(new Point3D(30, -roomSize, -120), new Point3D(30 + boxWidth, -roomSize + boxHeight, -120 + boxDepth), boxMat));

  // Сфера 1 (на кубе)
  const sphere1Mat = createObjectMaterial(sphere1Color, options.sphere1Mirror || false, options.sphere1Transparent || false, options.refractiveIndex || 1.5);
  scene.add(new Sphere(new Point3D(-90, -roomSize + cubeSize + 35, -20), 35, sphere1Mat));

  // Сфера 2 (на полу справа)
  const sphere2Mat = createObjectMaterial(sphere2Color, options.sphere2Mirror || false, options.sphere2Transparent || false, options.refractiveIndex || 1.5);
  scene.add(new Sphere(new Point3D(100, -roomSize + 40, 50), 40, sphere2Mat));

  // Основной источник света (на потолке)
  const light1Pos = options.light1Pos || new Point3D(0, roomSize - 10, 0);
  const light1Intensity = options.light1Intensity !== undefined ? options.light1Intensity : 1.0;
  scene.addLight(
    new RTLight(
      light1Pos,
      { r: 1, g: 1, b: 1 },
      light1Intensity,
      50 // Радиус для мягких теней
    )
  );

  // Дополнительный источник света
  if (options.enableLight2) {
    const light2Pos = options.light2Pos || new Point3D(150, 100, 150);
    const light2Intensity = options.light2Intensity !== undefined ? options.light2Intensity : 0.5;
    scene.addLight(new RTLight(light2Pos, { r: 1, g: 0.95, b: 0.9 }, light2Intensity, 20));
  }

  // Ambient light для более мягкого освещения
  scene.ambientLight = { r: 0.15, g: 0.15, b: 0.15 };

  return scene;
}
