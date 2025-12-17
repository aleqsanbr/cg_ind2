class Light {
  constructor(position, color = { r: 1, g: 1, b: 1 }, intensity = 1.0) {
    this.position = position;
    this.color = color;
    this.intensity = intensity;
  }
}

class Material {
  constructor(color = { r: 0.5, g: 0.5, b: 0.5 }, ambient = 0.1, diffuse = 0.7, specular = 0.3, shininess = 32) {
    this.color = color;
    this.ambient = ambient;
    this.diffuse = diffuse;
    this.specular = specular;
    this.shininess = shininess;
  }
}

class RTMaterial extends Material {
  constructor(color, ambient = 0.1, diffuse = 0.7, specular = 0.2, shininess = 32, reflectivity = 0, transparency = 0, refractiveIndex = 1.5) {
    super(color, ambient, diffuse, specular, shininess);
    this.reflectivity = reflectivity;
    this.transparency = transparency;
    this.refractiveIndex = refractiveIndex;
  }
}

class RTLight extends Light {
  constructor(position, color = { r: 1, g: 1, b: 1 }, intensity = 1.0, radius = 10) {
    super(position, color, intensity);
    this.radius = radius;
  }
}

class VectorMath {
  static dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static length(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  static normalize(v) {
    const len = VectorMath.length(v);
    if (len < 0.0001) return new Point3D(0, 0, 0);
    return new Point3D(v.x / len, v.y / len, v.z / len);
  }

  static subtract(a, b) {
    return new Point3D(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  static add(a, b) {
    return new Point3D(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  static multiply(v, scalar) {
    return new Point3D(v.x * scalar, v.y * scalar, v.z * scalar);
  }

  static reflect(direction, normal) {
    const dot = 2 * VectorMath.dot(direction, normal);
    return new Point3D(direction.x - dot * normal.x, direction.y - dot * normal.y, direction.z - dot * normal.z);
  }

  static refract(direction, normal, etaRatio) {
    const cosTheta = Math.min(-VectorMath.dot(direction, normal), 1.0);
    const sinTheta = Math.sqrt(1.0 - cosTheta * cosTheta);

    if (etaRatio * sinTheta > 1.0) {
      return null;
    }

    const rOutPerpX = etaRatio * (direction.x + cosTheta * normal.x);
    const rOutPerpY = etaRatio * (direction.y + cosTheta * normal.y);
    const rOutPerpZ = etaRatio * (direction.z + cosTheta * normal.z);

    const perpLenSq = rOutPerpX * rOutPerpX + rOutPerpY * rOutPerpY + rOutPerpZ * rOutPerpZ;
    const parallelCoef = -Math.sqrt(Math.abs(1.0 - perpLenSq));

    return new Point3D(rOutPerpX + parallelCoef * normal.x, rOutPerpY + parallelCoef * normal.y, rOutPerpZ + parallelCoef * normal.z);
  }

  static randomUnitVector() {
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const sinPhi = Math.sin(phi);
    return new Point3D(sinPhi * Math.cos(theta), sinPhi * Math.sin(theta), Math.cos(phi));
  }

  static randomInUnitDisk() {
    const r = Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    return new Point3D(r * Math.cos(theta), r * Math.sin(theta), 0);
  }
}
