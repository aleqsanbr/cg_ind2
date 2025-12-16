//
// Геометрические примитивы для ray tracing
//

// Луч
class Ray {
  constructor(origin, direction) {
    this.origin = origin; // Point3D
    this.direction = direction.clone(); // Point3D (normalized)
    this.normalize();
  }

  normalize() {
    const len = Math.sqrt(this.direction.x * this.direction.x + this.direction.y * this.direction.y + this.direction.z * this.direction.z);
    if (len > 0.0001) {
      this.direction.x /= len;
      this.direction.y /= len;
      this.direction.z /= len;
    }
  }

  at(t) {
    return new Point3D(this.origin.x + this.direction.x * t, this.origin.y + this.direction.y * t, this.origin.z + this.direction.z * t);
  }
}

// Запись пересечения
class HitRecord {
  constructor() {
    this.t = Infinity;
    this.point = null;
    this.normal = null;
    this.material = null;
    this.frontFace = true;
  }

  setFaceNormal(ray, outwardNormal) {
    const dotProduct = ray.direction.x * outwardNormal.x + ray.direction.y * outwardNormal.y + ray.direction.z * outwardNormal.z;
    this.frontFace = dotProduct < 0;

    if (this.frontFace) {
      this.normal = outwardNormal.clone();
    } else {
      this.normal = new Point3D(-outwardNormal.x, -outwardNormal.y, -outwardNormal.z);
    }
  }
}

// Сфера
class Sphere {
  constructor(center, radius, material) {
    this.center = center; // Point3D
    this.radius = radius;
    this.material = material; // RTMaterial
  }

  hit(ray, tMin, tMax, rec) {
    const oc = new Point3D(ray.origin.x - this.center.x, ray.origin.y - this.center.y, ray.origin.z - this.center.z);

    const a = ray.direction.x * ray.direction.x + ray.direction.y * ray.direction.y + ray.direction.z * ray.direction.z;

    const halfB = oc.x * ray.direction.x + oc.y * ray.direction.y + oc.z * ray.direction.z;

    const c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - this.radius * this.radius;

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

    const outwardNormal = new Point3D((rec.point.x - this.center.x) / this.radius, (rec.point.y - this.center.y) / this.radius, (rec.point.z - this.center.z) / this.radius);

    rec.setFaceNormal(ray, outwardNormal);
    rec.material = this.material;

    return true;
  }
}

// Axis-Aligned Box (куб/параллелепипед)
class Box {
  constructor(minPoint, maxPoint, material) {
    this.min = minPoint; // Point3D
    this.max = maxPoint; // Point3D
    this.material = material; // RTMaterial
  }

  hit(ray, tMin, tMax, rec) {
    let tNear = tMin;
    let tFar = tMax;
    let hitNormal = new Point3D(0, 0, 0);
    let hitAxis = -1;

    const axes = ['x', 'y', 'z'];

    for (let i = 0; i < 3; i++) {
      const axis = axes[i];
      const invD = 1.0 / ray.direction[axis];

      let t0 = (this.min[axis] - ray.origin[axis]) * invD;
      let t1 = (this.max[axis] - ray.origin[axis]) * invD;

      let normalSign = 1;
      if (invD < 0) {
        [t0, t1] = [t1, t0];
        normalSign = -1;
      }

      if (t0 > tNear) {
        tNear = t0;
        hitNormal = new Point3D(0, 0, 0);
        hitNormal[axis] = -normalSign;
        hitAxis = i;
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

// Квадрат (для стен Cornell Box)
class Quad {
  constructor(corner, edge1, edge2, material) {
    this.corner = corner; // Point3D
    this.edge1 = edge1; // Point3D (вектор)
    this.edge2 = edge2; // Point3D (вектор)
    this.material = material;

    // Вычисляем нормаль через векторное произведение
    this.normal = this.crossProduct(edge1, edge2);
    this.normalizeVector(this.normal);

    // Вычисляем d для уравнения плоскости
    this.d = this.normal.x * corner.x + this.normal.y * corner.y + this.normal.z * corner.z;
  }

  crossProduct(a, b) {
    return new Point3D(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }

  normalizeVector(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len > 0.0001) {
      v.x /= len;
      v.y /= len;
      v.z /= len;
    }
  }

  hit(ray, tMin, tMax, rec) {
    const denom = ray.direction.x * this.normal.x + ray.direction.y * this.normal.y + ray.direction.z * this.normal.z;

    if (Math.abs(denom) < 0.0001) return false;

    const t = (this.d - (this.normal.x * ray.origin.x + this.normal.y * ray.origin.y + this.normal.z * ray.origin.z)) / denom;

    if (t < tMin || t > tMax) return false;

    const intersection = ray.at(t);

    // Вектор от угла до точки пересечения
    const planarHitPt = new Point3D(intersection.x - this.corner.x, intersection.y - this.corner.y, intersection.z - this.corner.z);

    // Проверяем, что точка внутри квадрата
    const alpha = (planarHitPt.x * this.edge1.x + planarHitPt.y * this.edge1.y + planarHitPt.z * this.edge1.z) / (this.edge1.x * this.edge1.x + this.edge1.y * this.edge1.y + this.edge1.z * this.edge1.z);

    const beta = (planarHitPt.x * this.edge2.x + planarHitPt.y * this.edge2.y + planarHitPt.z * this.edge2.z) / (this.edge2.x * this.edge2.x + this.edge2.y * this.edge2.y + this.edge2.z * this.edge2.z);

    if (alpha < 0 || alpha > 1 || beta < 0 || beta > 1) return false;

    rec.t = t;
    rec.point = intersection;
    rec.setFaceNormal(ray, this.normal);
    rec.material = this.material;

    return true;
  }
}
