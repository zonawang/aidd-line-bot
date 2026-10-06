export interface Location {
  latitude: number;
  longitude: number;
}

export function isLocation(value: Location): boolean {
  return (
    Number.isFinite(value.latitude) &&
    Math.abs(value.latitude) <= 90 &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.longitude) <= 180
  );
}

export function distanceMeters(origin: Location, destination: Location): number {
  if (!isLocation(origin) || !isLocation(destination)) return Infinity;
  const radians = Math.PI / 180;
  const majorAxis = 6_378_137;
  const flattening = 1 / 298.257223563;
  const minorAxis = (1 - flattening) * majorAxis;
  const rawDelta = destination.longitude - origin.longitude;
  const longitudeDelta =
    Math.abs(rawDelta) <= 180 ? rawDelta : rawDelta - Math.sign(rawDelta) * 360;
  if (origin.latitude === 0 && destination.latitude === 0) {
    return majorAxis * radians * Math.abs(longitudeDelta);
  }
  const reducedOrigin = Math.atan((1 - flattening) * Math.tan(origin.latitude * radians));
  const reducedDestination = Math.atan((1 - flattening) * Math.tan(destination.latitude * radians));
  const sinOrigin = Math.sin(reducedOrigin);
  const cosOrigin = Math.cos(reducedOrigin);
  const sinDestination = Math.sin(reducedDestination);
  const cosDestination = Math.cos(reducedDestination);
  const longitude = longitudeDelta * radians;
  let lambda = longitude;
  let sigma = 0;
  let sinSigma = 0;
  let cosSigma = 0;
  let cosAlphaSquared = 0;
  let cosDoubleSigma = 0;
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    sinSigma = Math.hypot(
      cosDestination * sinLambda,
      cosOrigin * sinDestination - sinOrigin * cosDestination * cosLambda,
    );
    if (sinSigma === 0) return 0;
    cosSigma = sinOrigin * sinDestination + cosOrigin * cosDestination * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosOrigin * cosDestination * sinLambda) / sinSigma;
    cosAlphaSquared = 1 - sinAlpha * sinAlpha;
    cosDoubleSigma =
      cosAlphaSquared < 1e-15 ? 0 : cosSigma - (2 * sinOrigin * sinDestination) / cosAlphaSquared;
    const coefficient =
      (flattening / 16) * cosAlphaSquared * (4 + flattening * (4 - 3 * cosAlphaSquared));
    const next =
      longitude +
      (1 - coefficient) *
        flattening *
        sinAlpha *
        (sigma +
          coefficient *
            sinSigma *
            (cosDoubleSigma + coefficient * cosSigma * (-1 + 2 * cosDoubleSigma ** 2)));
    if (Math.abs(next - lambda) < 1e-12) break;
    if (iteration === 99) return Infinity;
    lambda = next;
  }
  const axisRatio = (cosAlphaSquared * (majorAxis ** 2 - minorAxis ** 2)) / minorAxis ** 2;
  const scale =
    1 + (axisRatio / 16384) * (4096 + axisRatio * (-768 + axisRatio * (320 - 175 * axisRatio)));
  const correction =
    (axisRatio / 1024) * (256 + axisRatio * (-128 + axisRatio * (74 - 47 * axisRatio)));
  const deltaSigma =
    correction *
    sinSigma *
    (cosDoubleSigma +
      (correction / 4) *
        (cosSigma * (-1 + 2 * cosDoubleSigma ** 2) -
          (correction / 6) *
            cosDoubleSigma *
            (-3 + 4 * sinSigma ** 2) *
            (-3 + 4 * cosDoubleSigma ** 2)));
  return minorAxis * scale * (sigma - deltaSigma);
}
