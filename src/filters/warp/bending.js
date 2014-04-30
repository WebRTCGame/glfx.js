/**
 * @filter         Bending in / out
 * @description    Bending the image forward or backward.
 * @param centerX  The x coordinate bending center.
 * @param centerY  The y coordinate bending center.
 * @param radius   The radius of the bending area of effect.
 * @param strength -1 to 1 (-1 is strong pinch, 0 is no effect, 1 is strong bulge)
 */
function bending(centerX, centerY, radius, strength) {
    gl.bending = gl.bending || warpShader('\
        uniform float radius;\
        uniform float strength;\
        uniform vec2 center;\
    ', '\
        coord -= center;\
        float distance = abs(coord.x);\
        float r = radius;\
        if (distance < r) {\
            float percent = distance / r;\
            if (strength > 0.0) {\
                coord.x *= mix(1.0, smoothstep(0.0, r / distance, distance / r), strength * 0.75);\
            } else {\
                coord.x *= mix(1.0, smoothstep(0.0, r / distance, distance / r), abs(strength) * 0.75);\
            }\
            coord.y += strength * r * 0.25 * (1.0 + sin(  3.1415926 * (0.5 - percent) ));\
        }\
        coord += center;\
    ');

    simpleShader.call(this, gl.bending, {
        radius: radius,
        strength: clamp(-1, strength, 1),
        center: [centerX, centerY],
        texSize: [this.width, this.height]
    });

    return this;
}
