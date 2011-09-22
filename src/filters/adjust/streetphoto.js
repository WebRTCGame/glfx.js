/**
 * @filter         Sepia
 * @description    Gives the image a reddish-brown monochrome tint that imitates an old photograph.
 * @param amount   0 to 1 (0 for no effect, 1 for full sepia coloring)
 */
function streetPhoto(amount) {
    gl.streetPhoto = gl.streetPhoto || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float amount;\
        uniform vec2 texSize;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            vec4 orig = color;\
            \
            /* High pass filter */\
            vec4 highpass = color * 5.0;\
            \
            float dx = 1.0 / texSize.x;\
            float dy = 1.0 / texSize.y;\
            highpass += texture2D(texture, texCoord + vec2(-dx, -dy)) * -0.625;\
            highpass += texture2D(texture, texCoord + vec2(dx, -dy)) * -0.625;\
            highpass += texture2D(texture, texCoord + vec2(dx, dy)) * -0.625;\
            highpass += texture2D(texture, texCoord + vec2(-dx, dy)) * -0.625;\
            highpass += texture2D(texture, texCoord + vec2(-dx * 2.0, -dy * 2.0)) * -0.625;\
            highpass += texture2D(texture, texCoord + vec2(dx * 2.0, -dy * 2.0)) * -0.625;\
            highpass += texture2D(texture, texCoord + vec2(dx * 2.0, dy * 2.0)) * -0.625;\
            highpass += texture2D(texture, texCoord + vec2(-dx * 2.0, dy * 2.0)) * -0.625;\
            highpass.a = 1.0;\
            \
            /* Overlay blend */\
            vec3 overlay = vec3(1.0);\
            if (highpass.r <= 0.5) {\
                overlay.r = 2.0 * color.r * highpass.r;\
            } else {\
                overlay.r = 1.0 - 2.0 * (1.0 - color.r) * (1.0 - highpass.r);\
            }\
            if (highpass.g <= 0.5) {\
                overlay.g = 2.0 * color.g * highpass.g;\
            } else {\
                overlay.g = 1.0 - 2.0 * (1.0 - color.g) * (1.0 - highpass.g);\
            }\
            if (highpass.b <= 0.5) {\
                overlay.b = 2.0 * color.b * highpass.b;\
            } else {\
                overlay.b = 1.0 - 2.0 * (1.0 - color.b) * (1.0 - highpass.b);\
            }\
            color.rgb = (overlay * 0.8) + (orig.rgb * 0.2);\
            \
            /* Desaturated hard light */\
            vec3 desaturated = vec3(orig.r + orig.g + orig.b / 3.0);\
            if (desaturated.r <= 0.5) {\
                color.rgb = 2.0 * color.rgb * desaturated;\
            } else {\
                color.rgb = vec3(1.0) - vec3(2.0) * (vec3(1.0) - color.rgb) * (vec3(1.0) - desaturated);\
            }\
            color = (orig * 0.6) + (color * 0.4);\
            \
            /* Add back some color */\
            float average = (color.r + color.g + color.b) / 3.0;\
            color.rgb += (average - color.rgb) * (1.0 - 1.0 / (1.001 - 0.45));\
            \
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.streetPhoto, {
        amount: clamp(0, amount, 1),
        texSize: [this._.texture.width, this._.texture.height]
    });

    return this;
}
