class RayTracer {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.maxDepth = 5;
    this.scene = new Scene();
    this.samplesPerPixel = 1;
    this.shadowSamples = 20;
    this.cameraPos = new Point3D(0, 0, 600);
    this.fov = 40;
  }

  setMaxDepth(depth) {
    this.maxDepth = depth;
  }

  schlick(cosine, refIdx) {
    let r0 = (1 - refIdx) / (1 + refIdx);
    r0 = r0 * r0;
    return r0 + (1 - r0) * Math.pow(1 - cosine, 5);
  }

  calculateSoftShadow(point, light, normal) {
    let shadowFactor = 0;
    const samples = this.shadowSamples;

    for (let i = 0; i < samples; i++) {
      const randomOffset = VectorMath.randomInUnitDisk();
      const lightSamplePos = new Point3D(light.position.x + randomOffset.x * light.radius, light.position.y + randomOffset.y * light.radius, light.position.z + randomOffset.z * light.radius);

      const toLightVec = VectorMath.subtract(lightSamplePos, point);
      const distToLight = VectorMath.length(toLightVec);
      const toLightDir = VectorMath.normalize(toLightVec);

      if (VectorMath.dot(toLightDir, normal) <= 0) {
        shadowFactor += 1.0;
        continue;
      }

      const shadowOrigin = VectorMath.add(point, VectorMath.multiply(normal, 0.001));
      const shadowRay = new Ray(shadowOrigin, toLightDir);
      const hit = this.scene.hit(shadowRay, 0.001, distToLight - 0.001);

      if (hit) {
        if (hit.material.transparency > 0) {
          shadowFactor += 1 - hit.material.transparency * 0.8;
        } else {
          shadowFactor += 1.0;
        }
      }
    }

    return shadowFactor / samples;
  }

  shade(rec, ray) {
    const material = rec.material;
    let color = {
      r: material.color.r * (material.ambient + this.scene.ambientLight.r * 0.5),
      g: material.color.g * (material.ambient + this.scene.ambientLight.g * 0.5),
      b: material.color.b * (material.ambient + this.scene.ambientLight.b * 0.5)
    };

    const viewDir = VectorMath.normalize(VectorMath.subtract(ray.origin, rec.point));

    for (const light of this.scene.lights) {
      const toLightVec = VectorMath.subtract(light.position, rec.point);
      const distToLight = VectorMath.length(toLightVec);
      const lightDir = VectorMath.normalize(toLightVec);

      const shadowFactor = this.calculateSoftShadow(rec.point, light, rec.normal);
      if (shadowFactor >= 0.99) continue;

      const lightContribution = 1.0 - shadowFactor;
      const attenuation = 1.0 / (1.0 + 0.0001 * distToLight * distToLight);

      const diff = Math.max(0, VectorMath.dot(rec.normal, lightDir));
      const diffuse = {
        r: material.color.r * material.diffuse * diff * light.intensity * light.color.r * attenuation,
        g: material.color.g * material.diffuse * diff * light.intensity * light.color.g * attenuation,
        b: material.color.b * material.diffuse * diff * light.intensity * light.color.b * attenuation
      };

      const reflectDir = VectorMath.reflect(VectorMath.multiply(lightDir, -1), rec.normal);
      const specDot = Math.max(0, VectorMath.dot(viewDir, reflectDir));
      const spec = Math.pow(specDot, material.shininess);

      const specular = {
        r: light.color.r * material.specular * spec * light.intensity * attenuation,
        g: light.color.g * material.specular * spec * light.intensity * attenuation,
        b: light.color.b * material.specular * spec * light.intensity * attenuation
      };

      color.r += (diffuse.r + specular.r) * lightContribution;
      color.g += (diffuse.g + specular.g) * lightContribution;
      color.b += (diffuse.b + specular.b) * lightContribution;
    }

    return color;
  }

  trace(ray, depth) {
    if (depth <= 0) {
      return { r: 0, g: 0, b: 0 };
    }

    const rec = this.scene.hit(ray, 0.001, Infinity);
    if (!rec) {
      return this.scene.backgroundColor;
    }

    const material = rec.material;
    const hasReflection = material.reflectivity > 0.01;
    const hasTransparency = material.transparency > 0.01;

    if (!hasReflection && !hasTransparency) {
      return this.shade(rec, ray);
    }

    let finalColor = { r: 0, g: 0, b: 0 };

    if (hasTransparency) {
      const refractiveIndex = material.refractiveIndex;
      const etaRatio = rec.frontFace ? 1.0 / refractiveIndex : refractiveIndex;
      const cosTheta = Math.min(-VectorMath.dot(ray.direction, rec.normal), 1.0);
      const sinTheta = Math.sqrt(1.0 - cosTheta * cosTheta);
      const cannotRefract = etaRatio * sinTheta > 1.0;

      const epsilon = 0.001;

      if (cannotRefract) {
        const reflectDir = VectorMath.reflect(ray.direction, rec.normal);
        const offset = VectorMath.multiply(rec.normal, epsilon);
        const reflectOrigin = VectorMath.add(rec.point, offset);
        const reflectRay = new Ray(reflectOrigin, reflectDir);
        finalColor = this.trace(reflectRay, depth - 1);
      } else {
        const reflectProb = this.schlick(cosTheta, etaRatio);

        const reflectDir = VectorMath.reflect(ray.direction, rec.normal);
        const reflectOffset = VectorMath.multiply(rec.normal, epsilon);
        const reflectOrigin = VectorMath.add(rec.point, reflectOffset);
        const reflectRay = new Ray(reflectOrigin, reflectDir);
        const reflectedColor = this.trace(reflectRay, depth - 1);

        const refractDir = VectorMath.refract(ray.direction, rec.normal, etaRatio);
        let refractedColor;

        if (refractDir) {
          const refractOffset = VectorMath.multiply(rec.normal, -epsilon);
          const refractOrigin = VectorMath.add(rec.point, refractOffset);
          const refractRay = new Ray(refractOrigin, refractDir);
          refractedColor = this.trace(refractRay, depth - 1);
        } else {
          refractedColor = reflectedColor;
        }

        finalColor = {
          r: reflectedColor.r * reflectProb + refractedColor.r * (1 - reflectProb),
          g: reflectedColor.g * reflectProb + refractedColor.g * (1 - reflectProb),
          b: reflectedColor.b * reflectProb + refractedColor.b * (1 - reflectProb)
        };
      }
    } else if (hasReflection) {
      const localColor = this.shade(rec, ray);
      const reflectDir = VectorMath.reflect(ray.direction, rec.normal);
      const reflectOrigin = VectorMath.add(rec.point, VectorMath.multiply(rec.normal, 0.001));
      const reflectRay = new Ray(reflectOrigin, reflectDir);
      const reflectColor = this.trace(reflectRay, depth - 1);

      finalColor = {
        r: localColor.r * (1 - material.reflectivity) + reflectColor.r * material.reflectivity,
        g: localColor.g * (1 - material.reflectivity) + reflectColor.g * material.reflectivity,
        b: localColor.b * (1 - material.reflectivity) + reflectColor.b * material.reflectivity
      };
    }

    return finalColor;
  }

  async renderAsync(ctx, onProgress = null) {
    const imageData = ctx.createImageData(this.width, this.height);
    const data = imageData.data;

    const aspectRatio = this.width / this.height;
    const scale = Math.tan((this.fov * Math.PI) / 180 / 2);

    for (let startY = 0; startY < this.height; startY += 5) {
      const endY = Math.min(startY + 5, this.height);

      for (let y = startY; y < endY; y++) {
        for (let x = 0; x < this.width; x++) {
          const px = ((2 * (x + 0.5)) / this.width - 1) * aspectRatio * scale;
          const py = (1 - (2 * (y + 0.5)) / this.height) * scale;

          const rayDir = new Point3D(px, py, -1);
          const ray = new Ray(this.cameraPos, rayDir);

          let color = this.trace(ray, this.maxDepth);

          color = {
            r: Math.pow(Math.min(1, Math.max(0, color.r)), 1 / 2.2),
            g: Math.pow(Math.min(1, Math.max(0, color.g)), 1 / 2.2),
            b: Math.pow(Math.min(1, Math.max(0, color.b)), 1 / 2.2)
          };

          const idx = (y * this.width + x) * 4;
          data[idx] = Math.floor(color.r * 255);
          data[idx + 1] = Math.floor(color.g * 255);
          data[idx + 2] = Math.floor(color.b * 255);
          data[idx + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      if (onProgress) {
        onProgress(endY / this.height);
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (onProgress) {
      onProgress(1);
    }
  }
}
