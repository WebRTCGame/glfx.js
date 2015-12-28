/**
 * @filter           Brightness / Contrast
 * @description      Provides additive brightness and multiplicative contrast control.
 * @param brightness -1 to 1 (-1 is solid black, 0 is no change, and 1 is solid white)
 * @param contrast   -1 to 1 (-1 is solid gray, 0 is no change, and 1 is maximum contrast)
 */
function brightnessContrast(brightness, contrast) {
    gl.brightnessContrast = gl.brightnessContrast || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float brightness;\
        uniform float contrast;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            color.rgb += brightness;\
            if (contrast > 0.0) {\
                color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;\
            } else {\
                color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;\
            }\
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.brightnessContrast, {
        brightness: clamp(-1, brightness, 1),
        contrast: clamp(-1, contrast, 1)
    });

    return this;
}

function splineInterpolate(points) {
    var interpolator = new SplineInterpolator(points);
    var array = [];
    for (var i = 0; i < 256; i++) {
        array.push(clamp(0, Math.floor(interpolator.interpolate(i / 255) * 256), 255));
    }
    return array;
}

/**
 * @filter      Curves
 * @description A powerful mapping tool that transforms the colors in the image
 *              by an arbitrary function. The function is interpolated between
 *              a set of 2D points using splines. The curves filter can take
 *              either one or three arguments which will apply the mapping to
 *              either luminance or RGB values, respectively.
 * @param red   A list of points that define the function for the red channel.
 *              Each point is a list of two values: the value before the mapping
 *              and the value after the mapping, both in the range 0 to 1. For
 *              example, [[0,1], [1,0]] would invert the red channel while
 *              [[0,0], [1,1]] would leave the red channel unchanged. If green
 *              and blue are omitted then this argument also applies to the
 *              green and blue channels.
 * @param green (optional) A list of points that define the function for the green
 *              channel (just like for red).
 * @param blue  (optional) A list of points that define the function for the blue
 *              channel (just like for red).
 */
function curves(red, green, blue) {
    // Create the ramp texture
    red = splineInterpolate(red);
    if (arguments.length == 1) {
        green = blue = red;
    } else {
        green = splineInterpolate(green);
        blue = splineInterpolate(blue);
    }
    var array = [];
    for (var i = 0; i < 256; i++) {
        array.splice(array.length, 0, red[i], green[i], blue[i], 255);
    }
    this._.extraTexture.initFromBytes(256, 1, array);
    this._.extraTexture.use(1);

    gl.curves = gl.curves || new Shader(null, '\
        uniform sampler2D texture;\
        uniform sampler2D map;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            color.r = texture2D(map, vec2(color.r)).r;\
            color.g = texture2D(map, vec2(color.g)).g;\
            color.b = texture2D(map, vec2(color.b)).b;\
            gl_FragColor = color;\
        }\
    ');

    gl.curves.textures({
        map: 1
    });
    simpleShader.call(this, gl.curves, {});

    return this;
}

/**
 * @filter         Denoise
 * @description    Smooths over grainy noise in dark images using an 9x9 box filter
 *                 weighted by color intensity, similar to a bilateral filter.
 * @param exponent The exponent of the color intensity difference, should be greater
 *                 than zero. A value of zero just gives an 9x9 box blur and high values
 *                 give the original image, but ideal values are usually around 10-20.
 */
function denoise(exponent) {
    // Do a 9x9 bilateral box filter
    gl.denoise = gl.denoise || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float exponent;\
        uniform float strength;\
        uniform vec2 texSize;\
        varying vec2 texCoord;\
        void main() {\
            vec4 center = texture2D(texture, texCoord);\
            vec4 color = vec4(0.0);\
            float total = 0.0;\
            for (float x = -4.0; x <= 4.0; x += 1.0) {\
                for (float y = -4.0; y <= 4.0; y += 1.0) {\
                    vec4 sample = texture2D(texture, texCoord + vec2(x, y) / texSize);\
                    float weight = 1.0 - abs(dot(sample.rgb - center.rgb, vec3(0.25)));\
                    weight = pow(weight, exponent);\
                    color += sample * weight;\
                    total += weight;\
                }\
            }\
            gl_FragColor = color / total;\
        }\
    ');

    // Perform two iterations for stronger results
    for (var i = 0; i < 2; i++) {
        simpleShader.call(this, gl.denoise, {
            exponent: Math.max(0, exponent),
            texSize: [this.width, this.height]
        });
    }

    return this;
}

/**
 * @filter           Hue / Saturation
 * @description      Provides rotational hue and multiplicative saturation control. RGB color space
 *                   can be imagined as a cube where the axes are the red, green, and blue color
 *                   values. Hue changing works by rotating the color vector around the grayscale
 *                   line, which is the straight line from black (0, 0, 0) to white (1, 1, 1).
 *                   Saturation is implemented by scaling all color channel values either toward
 *                   or away from the average color channel value.
 * @param hue        -1 to 1 (-1 is 180 degree rotation in the negative direction, 0 is no change,
 *                   and 1 is 180 degree rotation in the positive direction)
 * @param saturation -1 to 1 (-1 is solid gray, 0 is no change, and 1 is maximum contrast)
 */
function hueSaturation(hue, saturation) {
    gl.hueSaturation = gl.hueSaturation || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float hue;\
        uniform float saturation;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            \
            /* hue adjustment, wolfram alpha: RotationTransform[angle, {1, 1, 1}][{x, y, z}] */\
            float angle = hue * 3.14159265;\
            float s = sin(angle), c = cos(angle);\
            vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;\
            float len = length(color.rgb);\
            color.rgb = vec3(\
                dot(color.rgb, weights.xyz),\
                dot(color.rgb, weights.zxy),\
                dot(color.rgb, weights.yzx)\
            );\
            \
            /* saturation adjustment */\
            float average = (color.r + color.g + color.b) / 3.0;\
            if (saturation > 0.0) {\
                color.rgb += (average - color.rgb) * (1.0 - 1.0 / (1.001 - saturation));\
            } else {\
                color.rgb += (average - color.rgb) * (-saturation);\
            }\
            \
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.hueSaturation, {
        hue: clamp(-1, hue, 1),
        saturation: clamp(-1, saturation, 1)
    });

    return this;
}

/**
 * @filter         Infrared
 * @description    Simulates infrared photography.
 * @param amount   0 to 1 (0 for no effect, 1 for full effect)
 */
function infrared(amount) {
    gl.infrared = gl.infrared || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float amount;\
        uniform vec2 texSize;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            vec4 orig = color;\
            \
            float dx = 1.0 / texSize.x;\
            float dy = 1.0 / texSize.y;\
            \
            /* Mix channels, favoring green */\
            float mix = (-color.r * 0.5) + (color.g * 2.25) + (-color.b * 0.5);\
            color.rgb = vec3(mix);\
            \
            /* Add in some color from original */\
            color = (color * 0.75) + (orig * 0.25);\
            \
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.infrared, {
        amount: clamp(0, amount, 1),
        texSize: [this._.texture.width, this._.texture.height]
    });

    return this;
}

/**
 * @filter         Noise
 * @description    Adds black and white noise to the image.
 * @param amount   0 to 1 (0 for no effect, 1 for maximum noise)
 */
function noise(amount) {
    gl.noise = gl.noise || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float amount;\
        varying vec2 texCoord;\
        float rand(vec2 co) {\
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);\
        }\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            \
            float diff = (rand(texCoord) - 0.5) * amount;\
            color.r += diff;\
            color.g += diff;\
            color.b += diff;\
            \
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.noise, {
        amount: clamp(0, amount, 1)
    });

    return this;
}

/**
 * @filter         Sepia
 * @description    Gives the image a reddish-brown monochrome tint that imitates an old photograph.
 * @param amount   0 to 1 (0 for no effect, 1 for full sepia coloring)
 */
function sepia(amount) {
    gl.sepia = gl.sepia || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float amount;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            float r = color.r;\
            float g = color.g;\
            float b = color.b;\
            \
            color.r = min(1.0, (r * (1.0 - (0.607 * amount))) + (g * (0.769 * amount)) + (b * (0.189 * amount)));\
            color.g = min(1.0, (r * 0.349 * amount) + (g * (1.0 - (0.314 * amount))) + (b * 0.168 * amount));\
            color.b = min(1.0, (r * 0.272 * amount) + (g * 0.534 * amount) + (b * (1.0 - (0.869 * amount))));\
            \
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.sepia, {
        amount: clamp(0, amount, 1)
    });

    return this;
}

/**
 * @filter         Skin
 * @description    Filters-out pixels not matching skin color.
 * from: 
 * Human skin color clustering for face detection
 * J. Kovac, P. Peer, F. Solina - 2003
 */
function skin() {
    gl.skin = gl.skin || new Shader(null, '\
        uniform sampler2D texture;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            float r = color.r;\
            float g = color.g;\
            float b = color.b;\
            \
            if ((r>45.0/255.0)&&(g>40.0/255.0)&&(b>20.0/255.0)\
                &&(r>g)&&(r>b)\
                &&(r-min(g,b)>15.0/255.0)\
                &&(abs(r-g)>15.0/255.0)){\
                gl_FragColor = color;\
            } else {\
                gl_FragColor = vec4(0.0,0.0,0.0,color.a);\
            }\
        }\
    ');

    simpleShader.call(this, gl.skin, {
        amount: clamp(0, 1)
    });

    return this;
}

/**
 * @filter           Split Tone
 * @description      Add split toning to the image after converting to grayscale
 * @param highlights RGBA array to colorize highlights, with values from 0 to 1
 * @param shadows    RGBA array to colorize shadows, with values from 0 to 1
 * @param mix        Amount to mix split toned image with original, 0 to 1
 */
function splitTone(highlight, shadows, mix) {
    gl.splitTone = gl.splitTone || new Shader(null, '\
        uniform sampler2D texture;\
        uniform vec4 color1;\
        uniform vec4 color2;\
        uniform float mix;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            \
            float avg = (color.r + color.g + color.b) / 3.0;\
            vec4 toned = (color1 * avg) + (color2 * (1.0 - avg));\
            \
            float rdiff = toned.r - avg;\
            float gdiff = toned.g - avg;\
            float bdiff = toned.b - avg;\
            \
            gl_FragColor = (vec4(avg + rdiff - (gdiff / 2.0) - (bdiff / 2.0), avg + gdiff - (rdiff / 2.0) - (bdiff / 2.0), avg + bdiff - (rdiff / 2.0) - (gdiff / 2.0), 1.0) * mix) + (color * (1.0 - mix));\
        }\
    ');
    
    simpleShader.call(this, gl.splitTone, {
        color1: highlight || [0.4, 0.15, 0.0, 1.0],
        color2: shadows || [0.04, 0.16, 0.28, 1.0],
        mix: clamp(0, mix, 1) || 1.0
    });

    return this;
}

/**
 * @filter         Street Photo Effect
 * @description    Gives the image a gritty, surreal contrasty effect
 * @param amount   0 to 1 (0 for no effect, 1 for full effect)
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
            gl_FragColor = (color * amount) + (orig * (1.0 - amount));\
        }\
    ');

    simpleShader.call(this, gl.streetPhoto, {
        amount: clamp(0, amount || 1.0, 1),
        texSize: [this._.texture.width, this._.texture.height]
    });

    return this;
}

/**
 * @filter         Unsharp Mask
 * @description    A form of image sharpening that amplifies high-frequencies in the image. It
 *                 is implemented by scaling pixels away from the average of their neighbors.
 * @param radius   The blur radius that calculates the average of the neighboring pixels.
 * @param strength A scale factor where 0 is no effect and higher values cause a stronger effect.
 */
function unsharpMask(radius, strength) {
    gl.unsharpMask = gl.unsharpMask || new Shader(null, '\
        uniform sampler2D blurredTexture;\
        uniform sampler2D originalTexture;\
        uniform float strength;\
        uniform float threshold;\
        varying vec2 texCoord;\
        void main() {\
            vec4 blurred = texture2D(blurredTexture, texCoord);\
            vec4 original = texture2D(originalTexture, texCoord);\
            gl_FragColor = mix(blurred, original, 1.0 + strength);\
        }\
    ');

    // Store a copy of the current texture in the second texture unit
    this._.extraTexture.ensureFormat(this._.texture);
    this._.texture.use();
    this._.extraTexture.drawTo(function() {
        Shader.getDefaultShader().drawRect();
    });

    // Blur the current texture, then use the stored texture to detect edges
    this._.extraTexture.use(1);
    this.triangleBlur(radius);
    gl.unsharpMask.textures({
        originalTexture: 1
    });
    simpleShader.call(this, gl.unsharpMask, {
        strength: strength
    });
    this._.extraTexture.unuse(1);

    return this;
}

/**
 * @filter       Vibrance
 * @description  Modifies the saturation of desaturated colors, leaving saturated colors unmodified.
 * @param amount -1 to 1 (-1 is minimum vibrance, 0 is no change, and 1 is maximum vibrance)
 */
function vibrance(amount) {
    gl.vibrance = gl.vibrance || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float amount;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            float average = (color.r + color.g + color.b) / 3.0;\
            float mx = max(color.r, max(color.g, color.b));\
            float amt = (mx - average) * (-amount * 3.0);\
            color.rgb = mix(color.rgb, vec3(mx), amt);\
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.vibrance, {
        amount: clamp(-1, amount, 1)
    });

    return this;
}

/**
 * @filter         Vignette
 * @description    Adds a simulated lens edge darkening effect.
 * @param size     0 to 1 (0 for center of frame, 1 for edge of frame)
 * @param amount   -1 to 1 (0 for no effect, 1 for maximum lens darkening, -1 for maximum lens lightening)
 * @param x        X offset in pixels, default 0
 * @param y        Y offset in pixels, default 0
 * @param width    Width of vignette in pixels, default canvas.width
 * @param height   Height of vignette in pixels, default canvas.height
 */
function vignette(size, amount, x, y, width, height) {
    gl.vignette = gl.vignette || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float size;\
        uniform float amount;\
        uniform vec2 offset;\
        uniform vec2 multiplier;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            \
            float dist = distance((texCoord * multiplier) + offset, vec2(0.5, 0.5));\
            if (amount < 0.0) {\
               color.rgb /= smoothstep(0.8, size * 0.8, dist * (-amount + size));\
            } else {\
               color.rgb *= smoothstep(0.8, size * 0.8, dist * (amount + size));\
            }\
            \
            gl_FragColor = color;\
        }\
    ');
    
    x = x || 0;
    y = y || 0;
    width = width || this.width;
    height = height || this.height;

    simpleShader.call(this, gl.vignette, {
        size: clamp(0, size, 1),
        amount: clamp(-1, amount, 1),
        offset: [x / width, y / height],
        multiplier: [this.width / width, this.height / height]
    });

    return this;
}

/**
 * @filter         White Balance
 * @description    Adjust image white balance. Internally this uses the curves filter.
 * @param amount   -1 to 1 (-1 for cooler, 0 for no effect, 1 for warmer)
 */
function whiteBalance(amount) {
     var r, b;
     
     var amount2 = Math.abs(amount) / 2.0;
     var amount4 = Math.abs(amount) / 4.0;
     
     if (amount > 0) {
         // Add red, remove blue and green
         r = [[0.0, 0.0 + amount2], [0.5, 0.5 + amount2], [1.0 - amount2, 1.0]];
         b = [[0.0 + amount4, 0.0], [0.5, 0.5 - amount4], [1.0, 1.0 - amount4]];
     } else {
         // Add blue, remove red and green
         r = [[0.0 + amount4, 0.0], [0.5, 0.5 - amount4], [1.0, 1.0 - amount4]];
         b = [[0.0, 0.0 + amount2], [0.5, 0.5 + amount2], [1.0 - amount2, 1.0]];
     }
     
     return this.curves(
         r,
         [[0.0 + amount4, 0.0], [0.5, 0.5 - amount4], [1.0 - amount4, 1.0]],
         b
     );
}

/**
 * @filter           Gaussian Blur
 * @description      
 * @param radius     the radius of the filter
 * @param angle      the rotation of the bokeh in radians
 */
function bilateral() {
    gl.bilateral = gl.bilateral || new Shader(null, '                                                              \
        const float RADIUS = 8.0;                                                                                  \
                                                                                                                   \
        uniform sampler2D texture;                                                                                 \
        varying vec2 texCoord;                                                                                     \
        uniform vec2 texSize;                                                                                      \
        uniform float preserve;                                                                                    \
                                                                                                                   \
        void main() {                                                                                              \
            vec4 acc   = vec4(0.0);                                                                                \
            vec4 count = vec4(0.0);                                                                                \
            vec4 center = texture2D(texture, vec2(texCoord.x, texCoord.y));                                        \
            for (float i=-RADIUS; i<=RADIUS; i+=1.0) {                                                             \
              for (float j=-RADIUS; j<=RADIUS; j+=1.0) {                                                           \
                 vec4 tmp = texture2D(texture, vec2(texCoord.x + (j / texSize.x), texCoord.y + (i / texSize.y)));  \
                 vec4 diff = (center - tmp);                                                                       \
                 diff.w = 0.0;                                                                                     \
                 float diff_map = exp(-1.0 * dot(diff, diff) * preserve);                                          \
                 float gaussian_w = exp( -0.5 * (i*i + j*j) / RADIUS);                                             \
                 float weight = diff_map * gaussian_w;                                                             \
                 acc += tmp * weight;                                                                              \
                 count += weight;                                                                                  \
              }                                                                                                    \
            }                                                                                                      \
            gl_FragColor = acc / count;                                                                            \
        }                                                                                                          \
    ');

    // Remap the texture values, which will help make the bokeh effect
    simpleShader.call(this, gl.bilateral, {
        texSize: [this.width, this.height],
        preserve: 8.0
    });

    return this;
}

/**
 * @filter           Gaussian Blur
 * @description      
 * @param radius     the radius of the filter
 * @param angle      the rotation of the bokeh in radians
 */
function boxblur() {
    gl.HBlur = gl.HBlur || new Shader(null, '                                 \
        const float RADIUS = 3.0;                                             \
                                                                              \
        uniform sampler2D texture;                                            \
        varying vec2 texCoord;                                                \
        uniform vec2 texSize;\
                                                                              \
        void main() {                                                         \
            vec4 color = vec4(0.0);                                           \
            for (float i=-RADIUS; i<=RADIUS; i+=1.0) {                        \
              color += texture2D(texture, vec2(texCoord.x + (i / texSize.x), texCoord.y));  \
            }                                                                 \
            gl_FragColor = color / (2.0 * RADIUS + 1.0);                      \
        }                                                                     \
    ');

    gl.VBlur = gl.VBlur || new Shader(null, '                                 \
        const float RADIUS = 3.0;                                             \
                                                                              \
        uniform sampler2D texture;                                            \
        varying vec2 texCoord;                                                \
        uniform vec2 texSize;\
                                                                              \
        void main() {                                                         \
            vec4 color = vec4(0.0);                                           \
            for (float i=-RADIUS; i<=RADIUS; i+=1.0) {                        \
              color += texture2D(texture, vec2(texCoord.x, texCoord.y + (i / texSize.y)));  \
            }                                                                 \
            gl_FragColor = color / (2.0 * RADIUS + 1.0);                      \
        }                                                                     \
    ');

    // Remap the texture values, which will help make the bokeh effect
    simpleShader.call(this, gl.HBlur, {
        texSize: [this.width, this.height]
    });

    simpleShader.call(this, gl.VBlur, {
        texSize: [this.width, this.height]
    });

    return this;
}

/**
 * @filter           Gaussian Blur
 * @description      Returns the blurred image.
 * @param size       Kernel size
 * @param sigma      Standard deviation
 */
function gaussian(size, sigma) {
    //We're gonna calculate the 2D kernel with the given parameters first
    //Using a 2D kernel is sooooo much more efficient than using a 3d kernel
    var values = new Array();
    var radius = Math.ceil(size/2);
    var halfradius = Math.ceil(radius/2);
    var sum = 0;
    for(var i = 0; i < size; i++) {
        var euler = 1/(Math.sqrt(2*Math.PI)*sigma);
        var pos = Math.abs(i-halfradius);
        var distance = (pos*pos)/(2*(sigma*sigma));
        var value = euler*Math.exp(-distance);
        values.push(value);
        sum += value;
    }
    var m = 1/sum;
    for(var i = 0; i < size; i++) {
        values[i] *= m;
    }
    
    //This looks pretty dirty, but since I'm a WebGL newbie, it's the only way I got it to run ... feel free to change it
    //We have to build two different fragment shaders, since we're using two 2D kernels instead of one 3D
    var fragmentx = '\
        uniform sampler2D texture;\
        varying vec2 texCoord;\
        void main(void) {\
            float gauss['+size+'];\
            ';
    for(var i = 0; i < size; i++) {
        fragmentx += '\
        gauss['+i+'] = '+values[i]+';\
        ';
    }
    fragmentx += '\
            vec3 values['+size+'];\
            vec3 sum = vec3(0.0, 0.0, 0.0);\
            vec2 pixel = vec2('+(1/this.width)+','+(1/this.height)+');\
        ';
    var fragmenty = fragmentx;
    fragmentx += '\
        vec2 pos = texCoord-vec2(pixel.x*'+halfradius+'.0, 0.0);\
    ';
    fragmenty += '\
        vec2 pos = texCoord-vec2(0.0, pixel.y*'+halfradius+'.0);\
    ';
    for(var i = 0; i < size; i++) {
        fragmentx += '\
            vec3 color'+i+' = texture2D(texture, pos).rgb;\
            sum += vec3(gauss['+i+'])*color'+i+';\
            pos += vec2(pixel.x, 0.0);\
        ';
        fragmenty += '\
            vec3 color'+i+' = texture2D(texture, pos).rgb;\
            sum += vec3(gauss['+i+'])*color'+i+';\
            pos += vec2(0.0, pixel.y);\
        ';
    }
    var b = '\
            gl_FragColor = vec4(sum, 1.0);\
        }\
    ';
    fragmentx += b;
    fragmenty += b;
    
    gl.gaussianx = gl.gaussianx || new Shader(null, fragmentx);
    gl.gaussiany = gl.gaussiany || new Shader(null, fragmenty);
    
    simpleShader.call(this, gl.gaussianx);
    simpleShader.call(this, gl.gaussiany);
    
    return this;
}

/**
 * @filter           Lens Blur
 * @description      Imitates a camera capturing the image out of focus by using a blur that generates
 *                   the large shapes known as bokeh. The polygonal shape of real bokeh is due to the
 *                   blades of the aperture diaphragm when it isn't fully open. This blur renders
 *                   bokeh from a 6-bladed diaphragm because the computation is more efficient. It
 *                   can be separated into three rhombi, each of which is just a skewed box blur.
 *                   This filter makes use of the floating point texture WebGL extension to implement
 *                   the brightness parameter, so there will be severe visual artifacts if brightness
 *                   is non-zero and the floating point texture extension is not available. The
 *                   idea was from John White's SIGGRAPH 2011 talk but this effect has an additional
 *                   brightness parameter that fakes what would otherwise come from a HDR source.
 * @param radius     the radius of the hexagonal disk convolved with the image
 * @param brightness -1 to 1 (the brightness of the bokeh, negative values will create dark bokeh)
 * @param angle      the rotation of the bokeh in radians
 */
function lensBlur(radius, brightness, angle) {
    // All averaging is done on values raised to a power to make more obvious bokeh
    // (we will raise the average to the inverse power at the end to compensate).
    // Without this the image looks almost like a normal blurred image. This hack is
    // obviously not realistic, but to accurately simulate this we would need a high
    // dynamic range source photograph which we don't have.
    gl.lensBlurPrePass = gl.lensBlurPrePass || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float power;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            color = pow(color, vec4(power));\
            gl_FragColor = vec4(color);\
        }\
    ');

    var common = '\
        uniform sampler2D texture0;\
        uniform sampler2D texture1;\
        uniform vec2 delta0;\
        uniform vec2 delta1;\
        uniform float power;\
        varying vec2 texCoord;\
        ' + randomShaderFunc + '\
        vec4 sample(vec2 delta) {\
            /* randomize the lookup values to hide the fixed number of samples */\
            float offset = random(vec3(delta, 151.7182), 0.0);\
            \
            vec4 color = vec4(0.0);\
            float total = 0.0;\
            for (float t = 0.0; t <= 30.0; t++) {\
                float percent = (t + offset) / 30.0;\
                color += texture2D(texture0, texCoord + delta * percent);\
                total += 1.0;\
            }\
            return color / total;\
        }\
    ';

    gl.lensBlur0 = gl.lensBlur0 || new Shader(null, common + '\
        void main() {\
            gl_FragColor = sample(delta0);\
        }\
    ');
    gl.lensBlur1 = gl.lensBlur1 || new Shader(null, common + '\
        void main() {\
            gl_FragColor = (sample(delta0) + sample(delta1)) * 0.5;\
        }\
    ');
    gl.lensBlur2 = gl.lensBlur2 || new Shader(null, common + '\
        void main() {\
            vec4 color = (sample(delta0) + 2.0 * texture2D(texture1, texCoord)) / 3.0;\
            gl_FragColor = pow(color, vec4(power));\
        }\
    ').textures({ texture1: 1 });

    // Generate
    var dir = [];
    for (var i = 0; i < 3; i++) {
        var a = angle + i * Math.PI * 2 / 3;
        dir.push([radius * Math.sin(a) / this.width, radius * Math.cos(a) / this.height]);
    }
    var power = Math.pow(10, clamp(-1, brightness, 1));

    // Remap the texture values, which will help make the bokeh effect
    simpleShader.call(this, gl.lensBlurPrePass, {
        power: power
    });

    // Blur two rhombi in parallel into extraTexture
    this._.extraTexture.ensureFormat(this._.texture);
    simpleShader.call(this, gl.lensBlur0, {
        delta0: dir[0]
    }, this._.texture, this._.extraTexture);
    simpleShader.call(this, gl.lensBlur1, {
        delta0: dir[1],
        delta1: dir[2]
    }, this._.extraTexture, this._.extraTexture);

    // Blur the last rhombus and combine with extraTexture
    simpleShader.call(this, gl.lensBlur0, {
        delta0: dir[1]
    });
    this._.extraTexture.use(1);
    simpleShader.call(this, gl.lensBlur2, {
        power: 1 / power,
        delta0: dir[2]
    });

    return this;
}

/**
 * @filter               Tilt Shift
 * @description          Simulates the shallow depth of field normally encountered in close-up
 *                       photography, which makes the scene seem much smaller than it actually
 *                       is. This filter assumes the scene is relatively planar, in which case
 *                       the part of the scene that is completely in focus can be described by
 *                       a line (the intersection of the focal plane and the scene). An example
 *                       of a planar scene might be looking at a road from above at a downward
 *                       angle. The image is then blurred with a blur radius that starts at zero
 *                       on the line and increases further from the line.
 * @param startX         The x coordinate of the start of the line segment.
 * @param startY         The y coordinate of the start of the line segment.
 * @param endX           The x coordinate of the end of the line segment.
 * @param endY           The y coordinate of the end of the line segment.
 * @param blurRadius     The maximum radius of the pyramid blur.
 * @param gradientRadius The distance from the line at which the maximum blur radius is reached.
 */
function tiltShift(startX, startY, endX, endY, blurRadius, gradientRadius) {
    gl.tiltShift = gl.tiltShift || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float blurRadius;\
        uniform float gradientRadius;\
        uniform vec2 start;\
        uniform vec2 end;\
        uniform vec2 delta;\
        uniform vec2 texSize;\
        varying vec2 texCoord;\
        ' + randomShaderFunc + '\
        void main() {\
            vec4 color = vec4(0.0);\
            float total = 0.0;\
            \
            /* randomize the lookup values to hide the fixed number of samples */\
            float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);\
            \
            vec2 normal = normalize(vec2(start.y - end.y, end.x - start.x));\
            float radius = smoothstep(0.0, 1.0, abs(dot(texCoord * texSize - start, normal)) / gradientRadius) * blurRadius;\
            for (float t = -30.0; t <= 30.0; t++) {\
                float percent = (t + offset - 0.5) / 30.0;\
                float weight = 1.0 - abs(percent);\
                vec4 sample = texture2D(texture, texCoord + delta / texSize * percent * radius);\
                \
                /* switch to pre-multiplied alpha to correctly blur transparent images */\
                sample.rgb *= sample.a;\
                \
                color += sample * weight;\
                total += weight;\
            }\
            \
            gl_FragColor = color / total;\
            \
            /* switch back from pre-multiplied alpha */\
            gl_FragColor.rgb /= gl_FragColor.a + 0.00001;\
        }\
    ');

    var dx = endX - startX;
    var dy = endY - startY;
    var d = Math.sqrt(dx * dx + dy * dy);
    simpleShader.call(this, gl.tiltShift, {
        blurRadius: blurRadius,
        gradientRadius: gradientRadius,
        start: [startX, startY],
        end: [endX, endY],
        delta: [dx / d, dy / d],
        texSize: [this.width, this.height]
    });
    simpleShader.call(this, gl.tiltShift, {
        blurRadius: blurRadius,
        gradientRadius: gradientRadius,
        start: [startX, startY],
        end: [endX, endY],
        delta: [-dy / d, dx / d],
        texSize: [this.width, this.height]
    });

    return this;
}

/**
 * @filter       Triangle Blur
 * @description  This is the most basic blur filter, which convolves the image with a
 *               pyramid filter. The pyramid filter is separable and is applied as two
 *               perpendicular triangle filters.
 * @param radius The radius of the pyramid convolved with the image.
 */
function triangleBlur(radius) {
    gl.triangleBlur = gl.triangleBlur || new Shader(null, '\
        uniform sampler2D texture;\
        uniform vec2 delta;\
        varying vec2 texCoord;\
        ' + randomShaderFunc + '\
        void main() {\
            vec4 color = vec4(0.0);\
            float total = 0.0;\
            \
            /* randomize the lookup values to hide the fixed number of samples */\
            float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);\
            \
            for (float t = -30.0; t <= 30.0; t++) {\
                float percent = (t + offset - 0.5) / 30.0;\
                float weight = 1.0 - abs(percent);\
                vec4 sample = texture2D(texture, texCoord + delta * percent);\
                \
                /* switch to pre-multiplied alpha to correctly blur transparent images */\
                sample.rgb *= sample.a;\
                \
                color += sample * weight;\
                total += weight;\
            }\
            \
            gl_FragColor = color / total;\
            \
            /* switch back from pre-multiplied alpha */\
            gl_FragColor.rgb /= gl_FragColor.a + 0.00001;\
        }\
    ');

    simpleShader.call(this, gl.triangleBlur, {
        delta: [radius / this.width, 0]
    });
    simpleShader.call(this, gl.triangleBlur, {
        delta: [0, radius / this.height]
    });

    return this;
}

/**
 * @filter         Zoom Blur
 * @description    Blurs the image away from a certain point, which looks like radial motion blur.
 * @param centerX  The x coordinate of the blur origin.
 * @param centerY  The y coordinate of the blur origin.
 * @param strength The strength of the blur. Values in the range 0 to 1 are usually sufficient,
 *                 where 0 doesn't change the image and 1 creates a highly blurred image.
 */
function zoomBlur(centerX, centerY, strength) {
    gl.zoomBlur = gl.zoomBlur || new Shader(null, '\
        uniform sampler2D texture;\
        uniform vec2 center;\
        uniform float strength;\
        uniform vec2 texSize;\
        varying vec2 texCoord;\
        ' + randomShaderFunc + '\
        void main() {\
            vec4 color = vec4(0.0);\
            float total = 0.0;\
            vec2 toCenter = center - texCoord * texSize;\
            \
            /* randomize the lookup values to hide the fixed number of samples */\
            float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);\
            \
            for (float t = 0.0; t <= 40.0; t++) {\
                float percent = (t + offset) / 40.0;\
                float weight = 4.0 * (percent - percent * percent);\
                vec4 sample = texture2D(texture, texCoord + toCenter * percent * strength / texSize);\
                \
                /* switch to pre-multiplied alpha to correctly blur transparent images */\
                sample.rgb *= sample.a;\
                \
                color += sample * weight;\
                total += weight;\
            }\
            \
            gl_FragColor = color / total;\
            \
            /* switch back from pre-multiplied alpha */\
            gl_FragColor.rgb /= gl_FragColor.a + 0.00001;\
        }\
    ');

    simpleShader.call(this, gl.zoomBlur, {
        center: [centerX, centerY],
        strength: strength,
        texSize: [this.width, this.height]
    });

    return this;
}

/**
 * @filter        Color Halftone
 * @description   Simulates a CMYK halftone rendering of the image by multiplying pixel values
 *                with a four rotated 2D sine wave patterns, one each for cyan, magenta, yellow,
 *                and black.
 * @param centerX The x coordinate of the pattern origin.
 * @param centerY The y coordinate of the pattern origin.
 * @param angle   The rotation of the pattern in radians.
 * @param size    The diameter of a dot in pixels.
 */
function colorHalftone(centerX, centerY, angle, size) {
    gl.colorHalftone = gl.colorHalftone || new Shader(null, '\
        uniform sampler2D texture;\
        uniform vec2 center;\
        uniform float angle;\
        uniform float scale;\
        uniform vec2 texSize;\
        varying vec2 texCoord;\
        \
        float pattern(float angle) {\
            float s = sin(angle), c = cos(angle);\
            vec2 tex = texCoord * texSize - center;\
            vec2 point = vec2(\
                c * tex.x - s * tex.y,\
                s * tex.x + c * tex.y\
            ) * scale;\
            return (sin(point.x) * sin(point.y)) * 4.0;\
        }\
        \
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            vec3 cmy = 1.0 - color.rgb;\
            float k = min(cmy.x, min(cmy.y, cmy.z));\
            cmy = (cmy - k) / (1.0 - k);\
            cmy = clamp(cmy * 10.0 - 3.0 + vec3(pattern(angle + 0.26179), pattern(angle + 1.30899), pattern(angle)), 0.0, 1.0);\
            k = clamp(k * 10.0 - 5.0 + pattern(angle + 0.78539), 0.0, 1.0);\
            gl_FragColor = vec4(1.0 - cmy - k, color.a);\
        }\
    ');

    simpleShader.call(this, gl.colorHalftone, {
        center: [centerX, centerY],
        angle: angle,
        scale: Math.PI / size,
        texSize: [this.width, this.height]
    });

    return this;
}

/**
 * @filter        Dot Screen
 * @description   Simulates a black and white halftone rendering of the image by multiplying
 *                pixel values with a rotated 2D sine wave pattern.
 * @param centerX The x coordinate of the pattern origin.
 * @param centerY The y coordinate of the pattern origin.
 * @param angle   The rotation of the pattern in radians.
 * @param size    The diameter of a dot in pixels.
 */
function dotScreen(centerX, centerY, angle, size, colorized) {
    gl.dotScreen = gl.dotScreen || new Shader(null, '\
        uniform sampler2D texture;\
        uniform vec2 center;\
        uniform float angle;\
        uniform float scale;\
        uniform vec2 texSize;\
        uniform vec4 colorized;\
        varying vec2 texCoord;\
        \
        float pattern() {\
            float s = sin(angle), c = cos(angle);\
            vec2 tex = texCoord * texSize - center;\
            vec2 point = vec2(\
                c * tex.x - s * tex.y,\
                s * tex.x + c * tex.y\
            ) * scale;\
            return (sin(point.x) * sin(point.y)) * 3.0;\
        }\
        \
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            float average = (color.r + color.g + color.b) / 3.0;\
            float val = average * 10.0 - 5.0 + pattern();\
            gl_FragColor = val > 0.86 ? colorized : vec4(vec3(val), color.a) + colorized;\
        }\
    ');

    simpleShader.call(this, gl.dotScreen, {
        center: [centerX, centerY],
        angle: angle,
        scale: Math.PI / size,
        texSize: [this.width, this.height],
        colorized: colorized || [0,0,0,0]
    });

    return this;
}

/**
 * @filter       Edge Work
 * @description  Picks out different frequencies in the image by subtracting two
 *               copies of the image blurred with different radii.
 * @param radius The radius of the effect in pixels.
 */
function edgeWork(radius) {
    gl.edgeWork1 = gl.edgeWork1 || new Shader(null, '\
        uniform sampler2D texture;\
        uniform vec2 delta;\
        varying vec2 texCoord;\
        ' + randomShaderFunc + '\
        void main() {\
            vec2 color = vec2(0.0);\
            vec2 total = vec2(0.0);\
            \
            /* randomize the lookup values to hide the fixed number of samples */\
            float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);\
            \
            for (float t = -30.0; t <= 30.0; t++) {\
                float percent = (t + offset - 0.5) / 30.0;\
                float weight = 1.0 - abs(percent);\
                vec3 sample = texture2D(texture, texCoord + delta * percent).rgb;\
                float average = (sample.r + sample.g + sample.b) / 3.0;\
                color.x += average * weight;\
                total.x += weight;\
                if (abs(t) < 15.0) {\
                    weight = weight * 2.0 - 1.0;\
                    color.y += average * weight;\
                    total.y += weight;\
                }\
            }\
            gl_FragColor = vec4(color / total, 0.0, 1.0);\
        }\
    ');
    gl.edgeWork2 = gl.edgeWork2 || new Shader(null, '\
        uniform sampler2D texture;\
        uniform vec2 delta;\
        varying vec2 texCoord;\
        ' + randomShaderFunc + '\
        void main() {\
            vec2 color = vec2(0.0);\
            vec2 total = vec2(0.0);\
            \
            /* randomize the lookup values to hide the fixed number of samples */\
            float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);\
            \
            for (float t = -30.0; t <= 30.0; t++) {\
                float percent = (t + offset - 0.5) / 30.0;\
                float weight = 1.0 - abs(percent);\
                vec2 sample = texture2D(texture, texCoord + delta * percent).xy;\
                color.x += sample.x * weight;\
                total.x += weight;\
                if (abs(t) < 15.0) {\
                    weight = weight * 2.0 - 1.0;\
                    color.y += sample.y * weight;\
                    total.y += weight;\
                }\
            }\
            float c = clamp(10000.0 * (color.y / total.y - color.x / total.x) + 0.5, 0.0, 1.0);\
            gl_FragColor = vec4(c, c, c, 1.0);\
        }\
    ');

    simpleShader.call(this, gl.edgeWork1, {
        delta: [radius / this.width, 0]
    });
    simpleShader.call(this, gl.edgeWork2, {
        delta: [0, radius / this.height]
    });

    return this;
}

/**
 * @filter       Glitch
 * @description  n/a
 *               
 * @param canvas / texture
 */
var Glitch = function(canvas, texture) {
    
    var gl = canvas._.gl;
    
    // draw texture on canvas　in advance for reading pixels from canvas.
    canvas.draw(texture);
    
    // reduce cost for getting pixel array each time
    var packPixels = canvas.getPixelArray();
    var packWidth;
    var packHeight;
    var packFormat;
    var packType;
    var pixelProcesser;
    
    this.width = function(w) {
        
        w = w || texture._.width;
        packWidth = w;
        
        return this;
    };
    
    this.height = function(h) {
        
        h = h || texture._.height;
        packHeight = h;
        
        return this;
    };
    
    this.shortenX = function(x) {
        
        x = x || 0;
        packWidth = texture._.width - x;
        
        return this;
    };
    
    this.shortenY = function(y) {
        
        y = y || 0;
        packHeight = texture._.height - y;
        
        return this;
    };
    
    this.type = function(type) {
        
        switch (type) {
            
            case exports.UNSIGNED_BYTE:
            case exports.UNSIGNED_SHORT_5_6_5:
            case exports.UNSIGNED_SHORT_4_4_4_4:
            case exports.UNSIGNED_SHORT_5_5_5_1:
                packType = type;
                break;
                
            default:
                console.log('[GLITCH TYPE ERROR] type supports only fx.UNSIGNED_BYTE, fx.UNSIGNED_SHORT_5_6_5, fx.UNSIGNED_SHORT_4_4_4_4, fx.UNSIGNED_SHORT_5_5_5_1.');
                break;
        };
        
        return this;
    };
    
    this.format = function(format) {
        
        switch (format) {
            
            case exports.ALPHA:
            case exports.LUMINANCE:
            case exports.LUMINANCE_ALPHA:
            case exports.RGB:
            case exports.RGBA:
                packFormat = format;
                break;
                
            default:
                console.log('[GLITCH FORMAT ERROR] format supports only fx.ALPHA, fx.LUMINANCE, fx.LUMINANCE_ALPHA, fx.RGB and fx.RGBA.');
                break;
        };
        
        return this;
    };
    
    this.offset = function(offset) {
        
        var a = packPixels.subarray(0, offset);
        var b = packPixels.subarray(offset, packPixels.length);
        var t = new Uint8Array(packPixels.length);
        var j = 0;
        
        for (var i = 0; i < b.length; i++) {
            t[j] = b[i];
            j++;
        }
        
        for (var i = 0; i < a.length; i++) {
            t[j] = a[i];
            j++;
        }
        
        packPixels = t;
        
        return this;
    };
    
    this.length = function() {
        
        return packPixels.length();
    };
    
    this.process = function(fn) {
        
        pixelProcesser = fn || function() {};
        
        return this;
    };
    
    this.update = function() {
        
        packWidth = packWidth || texture._.width;
        packHeight = packHeight || texture._.height;
        packFormat = packFormat || exports.RGBA;
        packType = packType || exports.UNSIGNED_BYTE;
        
        // handling pixel array
        pixelProcesser = pixelProcesser || function(pixels){};
        pixelProcesser(packPixels);
        
        gl.bindTexture(gl.TEXTURE_2D, texture._.id);
        gl.texImage2D(gl.TEXTURE_2D, 0, packFormat, packWidth, packHeight, 0, packFormat, packType, packPixels);
        canvas.draw(texture).update();
        
        return this;
    };
};

function glitch(texture) {
	return new Glitch(this, texture);
}

/**
 * @filter        Hexagonal Pixelate
 * @description   Renders the image using a pattern of hexagonal tiles. Tile colors
 *                are nearest-neighbor sampled from the centers of the tiles.
 * @param centerX The x coordinate of the pattern center.
 * @param centerY The y coordinate of the pattern center.
 * @param scale   The width of an individual tile, in pixels.
 */
function hexagonalPixelate(centerX, centerY, scale) {
    gl.hexagonalPixelate = gl.hexagonalPixelate || new Shader(null, '\
        uniform sampler2D texture;\
        uniform vec2 center;\
        uniform float scale;\
        uniform vec2 texSize;\
        varying vec2 texCoord;\
        void main() {\
            vec2 tex = (texCoord * texSize - center) / scale;\
            tex.y /= 0.866025404;\
            tex.x -= tex.y * 0.5;\
            \
            vec2 a;\
            if (tex.x + tex.y - floor(tex.x) - floor(tex.y) < 1.0) a = vec2(floor(tex.x), floor(tex.y));\
            else a = vec2(ceil(tex.x), ceil(tex.y));\
            vec2 b = vec2(ceil(tex.x), floor(tex.y));\
            vec2 c = vec2(floor(tex.x), ceil(tex.y));\
            \
            vec3 TEX = vec3(tex.x, tex.y, 1.0 - tex.x - tex.y);\
            vec3 A = vec3(a.x, a.y, 1.0 - a.x - a.y);\
            vec3 B = vec3(b.x, b.y, 1.0 - b.x - b.y);\
            vec3 C = vec3(c.x, c.y, 1.0 - c.x - c.y);\
            \
            float alen = length(TEX - A);\
            float blen = length(TEX - B);\
            float clen = length(TEX - C);\
            \
            vec2 choice;\
            if (alen < blen) {\
                if (alen < clen) choice = a;\
                else choice = c;\
            } else {\
                if (blen < clen) choice = b;\
                else choice = c;\
            }\
            \
            choice.x += choice.y * 0.5;\
            choice.y *= 0.866025404;\
            choice *= scale / texSize;\
            gl_FragColor = texture2D(texture, choice + center / texSize);\
        }\
    ');

    simpleShader.call(this, gl.hexagonalPixelate, {
        center: [centerX, centerY],
        scale: scale,
        texSize: [this.width, this.height]
    });

    return this;
}

/**
 * @filter         Ink
 * @description    Simulates outlining the image in ink by darkening edges stronger than a
 *                 certain threshold. The edge detection value is the difference of two
 *                 copies of the image, each blurred using a blur of a different radius.
 * @param strength The multiplicative scale of the ink edges. Values in the range 0 to 1
 *                 are usually sufficient, where 0 doesn't change the image and 1 adds lots
 *                 of black edges. Negative strength values will create white ink edges
 *                 instead of black ones.
 */
function ink(strength) {
    gl.ink = gl.ink || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float strength;\
        uniform vec2 texSize;\
        varying vec2 texCoord;\
        void main() {\
            vec2 dx = vec2(1.0 / texSize.x, 0.0);\
            vec2 dy = vec2(0.0, 1.0 / texSize.y);\
            vec4 color = texture2D(texture, texCoord);\
            float bigTotal = 0.0;\
            float smallTotal = 0.0;\
            vec3 bigAverage = vec3(0.0);\
            vec3 smallAverage = vec3(0.0);\
            for (float x = -2.0; x <= 2.0; x += 1.0) {\
                for (float y = -2.0; y <= 2.0; y += 1.0) {\
                    vec3 sample = texture2D(texture, texCoord + dx * x + dy * y).rgb;\
                    bigAverage += sample;\
                    bigTotal += 1.0;\
                    if (abs(x) + abs(y) < 2.0) {\
                        smallAverage += sample;\
                        smallTotal += 1.0;\
                    }\
                }\
            }\
            vec3 edge = max(vec3(0.0), bigAverage / bigTotal - smallAverage / smallTotal);\
            gl_FragColor = vec4(color.rgb - dot(edge, edge) * strength * 100000.0, color.a);\
        }\
    ');

    simpleShader.call(this, gl.ink, {
        strength: strength * strength * strength * strength * strength,
        texSize: [this.width, this.height]
    });

    return this;
}

/**
 * @filter         Brightness quantization
 * @description    Quick & dirty implementation of a quantization algorithm, that groups
 *                 colors by their brightness.
 * @param steps    The amount of steps in brightness.
 */
function brightnessQuantization(steps) {
    var fragment = '\
        uniform sampler2D texture;\
        varying vec2 texCoord;\
        vec3 rgb2hsv(vec3 rgb) {\
            float r = rgb.r;\
            float g = rgb.g;\
            float b = rgb.b;\
            float minch = min(r, min(g, b));\
            float maxch = max(r, max(g, b));\
            float h = 0.0;\
            float s = 0.0;\
            float v = maxch;\
            float d = maxch-minch;\
            if (d != 0.0) {\
                s = d/v;\
                if (r==v) {\
                    h = (g-b)/d;\
                } else if (g == v) {\
                    h = 2.0 + (b - r)/d;\
                } else {\
                    h = 4.0 + (r - g)/d;\
                }\
           }\
           return vec3(h, s, v);\
        }\
        vec3 hsv2rgb(vec3 hsv) {\
            vec3 rgb;\
            float h = hsv.x;\
            float s = hsv.y;\
            float v = hsv.z;\
            float i = floor(h);\
            float f = h-i;\
            float p = (1.0-s);\
            float q = (1.0-s*f);\
            float t = (1.0-s*(1.0-f));\
            if (i == 0.0) {\
                rgb = vec3(1.0, t, p);\
            } else if (i == 1.0) {\
                rgb = vec3(q, 1.0, p);\
            } else if (i == 2.0) {\
                rgb = vec3(p, 1.0, t);\
            } else if (i == 3.0) {\
                rgb = vec3(p, q, 1.0);\
            } else if (i == 4.0) {\
                rgb = vec3(t, p, 1.0);\
            } else {\
                rgb = vec3(1.0, p, q);\
            }\
            rgb *= v;\
            return rgb;\
        }\
        \
        void main(void) {\
            vec3 hsv = rgb2hsv(texture2D(texture, texCoord).rgb);\
            float v = hsv.z;\
            float step = 1.0/float('+steps+');\
            for(int i = 0; i < '+steps+'; i+=1) {\
                float min = step*float(i);\
                float max = step*float(i+1);\
                if((v >= min) && (v <= max)) {\
                    if(abs(v-min) <= abs(max-v)) {\
                        v = min;\
                    } else {\
                        v = max;\
                    }\
                }\
            }\
            hsv.z = v;\
            vec3 rgb = hsv2rgb(hsv);\
            gl_FragColor = vec4(rgb, 1.0);\
        }\
    ';
    
    gl.brightnessquantizationshader = gl.brightnessquantizationshader || new Shader(null, fragment);
    simpleShader.call(this, gl.brightnessquantizationshader);
    
    return this;
}

/**
 * @filter         Comic
 * @description    Quantizes the image and overlays it with the edge found by
 *                 a difference of gaussian filter (in this case using a bilateral filter).
 * @param sigma    Standard deviation for the gaussian/bilateral blur
 */
function comic(sigma) {
    //Using bilateral filter for better results
    //It isn't working on mobile devices though (why the hell ever ...)
    var buffer = this.contents()._;
    this.denoise(sigma);
    this._.extraTexture.ensureFormat(this._.texture);
    this._.texture.use();
    this._.extraTexture.drawTo(function() {
        Shader.getDefaultShader().drawRect();
    });
    this._.extraTexture.use(1);
    //Second biliteral filter
    this.denoise(sigma*1.6);
    
    //Now we're gonna subtract and threshold them to get the edges
    var fragment = '\
        uniform sampler2D texture0;\
        uniform sampler2D texture1;\
        varying vec2 texCoord;\
        \
        void main(void) {\
            vec4 color0 = texture2D(texture0, texCoord).rgba;\
            vec4 color1 = texture2D(texture1, texCoord).rgba;\
            color0 = color0 - color1;\
            if((color0.r <= 0.005) || (color0.g <= 0.005) || (color0.b <= 0.005)) {\
                color0.r = 1.0;\
                color0.g = 1.0;\
                color0.b = 1.0;\
                color0.a = 0.0;\
            } else {\
                color0.r = 0.0;\
                color0.g = 0.0;\
                color0.b = 0.0;\
                color0.a = 1.0;\
            }\
            gl_FragColor = color0;\
        }\
    ';
    
    gl.differenceofgaussian = gl.differenceofgaussian || new Shader(null, fragment).textures({ texture1: 1 });
    simpleShader.call(this, gl.differenceofgaussian);
    
    this._.extraTexture.unuse(1);
    
    this.gaussian(5.0, 0.8);
    
    var buffer2 = this.contents()._; 
    
    this._.texture.swapWith(buffer);
    
    this.denoise(sigma).update(),
    
    this.brightnessQuantization(4).update();
    
    this.join(buffer2);
    
    this._.extraTexture.destroy();
    
    return this;
}

//Returns the edges of the image with a transparent background.
//Will be used for a comic filter
function dog(sigma) {
    //Using biliteral filter for better results
    //It isn't working on mobile devices though (why the hell ever ...)
    this.denoise(sigma).update();
    this._.extraTexture.ensureFormat(this._.texture);
    this._.texture.use();
    this._.extraTexture.drawTo(function() {
        Shader.getDefaultShader().drawRect();
    });
    this._.extraTexture.use(1);
    //Second biliteral filter
    this.denoise(sigma*1.6).update();
    
    //Now we're gonna subtract and threshold them to get the edges
    var fragment = '\
        uniform sampler2D texture0;\
        uniform sampler2D texture1;\
        varying vec2 texCoord;\
        \
        void main(void) {\
            vec4 color0 = texture2D(texture0, texCoord).rgba;\
            vec4 color1 = texture2D(texture1, texCoord).rgba;\
            color0 = color0 - color1;\
            color0.a = 1.0;\
            if((color0.r <= 0.005) || (color0.g <= 0.005) || (color0.b <= 0.005)) {\
                color0.r = 1.0;\
                color0.g = 1.0;\
                color0.b = 1.0;\
                color0.a = 0.0;\
            }\
            gl_FragColor = color0;\
        }\
    ';
    
    gl.differenceofgaussian = gl.differenceofgaussian || new Shader(null, fragment).textures({ texture1: 1 });
    simpleShader.call(this, gl.differenceofgaussian);
    
    this._.extraTexture.unuse(1);
    
    //Free the memory
    this._.extraTexture.destroy();
    
    return this;
}

/**
 * @filter         Join
 * @description    Joins the image with a given black and white layer.
 *                 This is a quick and dirty implementation for the comic filter.
 * @param texture  Black and white image (where white->transparent and black->opaque)
 */
 
function join(texture) {
    
    texture.use(1);
    
    var fragment = '\
        uniform sampler2D texture0;\
        uniform sampler2D texture1;\
        varying vec2 texCoord;\
        \
        void main(void) {\
            vec4 color0 = texture2D(texture0, texCoord).rgba;\
            vec4 color1 = texture2D(texture1, texCoord).rgba;\
            vec3 grey = vec3(color1.r*0.3+color1.g*0.59+color1.b*0.11);\
            if(grey.r < 0.01) {\
                color0 = vec4(grey, 1.0);\
            }\
            gl_FragColor = color0;\
        }\
    ';
    
    gl.joinlayers = gl.joinlayers || new Shader(null, fragment).textures({ texture1: 1 });
    simpleShader.call(this, gl.joinlayers);
    
    this._.extraTexture.unuse(1);
    this._.extraTexture.destroy();
    
    texture.destroy();
    
    return this;
}

/**
 * @filter         Grid
 * @description    Draws a grid of a given color over the image.
 * @param distance X and Y distance between lines, e.g. [10, 25]. Defaults to the rule of
 *                 thirds grid.
 * @param color    RGBA color to draw as an array, e.g. [1.0, 0, 0]. Defaults to 50%
 *                 gray. The rendered color is the average of the existing pixel and 
 *                 the color passed into the filter.
 */
function grid(distance, color) {
    gl.grid = gl.grid || new Shader(null, '\
        uniform sampler2D texture;\
        uniform vec2 gridDistance;\
        uniform vec3 gridColor;\
        uniform vec2 texSize;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            \
            vec2 scaled = texCoord * texSize;\
            scaled.x = floor(scaled.x);\
            scaled.y = floor(scaled.y);\
            if (scaled.x == 0.0 || scaled.x == texSize.x - 1.0 || scaled.y == 0.0 || scaled.y == texSize.y - 1.0 || (mod(scaled.x, gridDistance.x) == 0.0) || (mod(scaled.y, gridDistance.y) == 0.0)) {\
                color.rgb = (color.rgb + gridColor) / 2.0;\
            }\
            \
            gl_FragColor = color;\
        }\
    ');

    if (distance == undefined)
        distance = [Math.round(this.width / 3), Math.round(this.height / 3)];

    if (color == undefined)
        color = [0.5, 0.5, 0.5];

    simpleShader.call(this, gl.grid, {
        gridDistance: distance,
        gridColor: color,
        texSize: [this.width, this.height]
    });

    return this;
}

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

/**
 * @filter         Bulge / Pinch
 * @description    Bulges or pinches the image in a circle.
 * @param centerX  The x coordinate of the center of the circle of effect.
 * @param centerY  The y coordinate of the center of the circle of effect.
 * @param radius   The radius of the circle of effect.
 * @param strength -1 to 1 (-1 is strong pinch, 0 is no effect, 1 is strong bulge)
 */
function bulgePinch(centerX, centerY, radius, strength) {
    gl.bulgePinch = gl.bulgePinch || warpShader('\
        uniform float radius;\
        uniform float strength;\
        uniform vec2 center;\
    ', '\
        coord -= center;\
        float distance = length(coord);\
        if (distance < radius) {\
            float percent = distance / radius;\
            if (strength > 0.0) {\
                coord *= mix(1.0, smoothstep(0.0, radius / distance, percent), strength * 0.75);\
            } else {\
                coord *= mix(1.0, pow(percent, 1.0 + strength * 0.75) * radius / distance, 1.0 - percent);\
            }\
        }\
        coord += center;\
    ');

    simpleShader.call(this, gl.bulgePinch, {
        radius: radius,
        strength: clamp(-1, strength, 1),
        center: [centerX, centerY],
        texSize: [this.width, this.height]
    });

    return this;
}

/**
 * @filter           Crop
 * @description      Crop the texture. This should be used along with passing the new
 *                   width/height to the canvas.draw() method because the image will
 *                   just be stretched without it.
 * @param left       Number of pixels to crop from the left side
 * @param top        Number of pixels to crop from the top side
 * @param right      Number of pixels to crop from the right side
 * @param bottom     Number of pixels to crop from the bottom side
 */
function crop(left, top, right, bottom) {
    gl.crop = gl.crop || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float left;\
        uniform float top;\
        uniform float right;\
        uniform float bottom;\
        varying vec2 texCoord;\
        void main() {\
            vec2 coord;\
            \
            coord.x = left + (texCoord.x * (1.0 - left - right));\
            coord.y = top + (texCoord.y * (1.0 - top - bottom));\
            \
            gl_FragColor = texture2D(texture, coord);\
        }\
    ');

    var w = this.width + left + right;
    var h = this.height + top + bottom;
    simpleShader.call(this, gl.crop, {
        left: left / w || 0,
        top: top / h || 0,
        right: right / w || 0,
        bottom: bottom / h || 0,
    });

    return this;
}

/**
 * @filter           Flip
 * @description      Flip an image vertically and/or horizontally
 * @param vertical   If true, flip vertically
 * @param horizontal If true, flip horizontally
 */
function flip(vertical, horizontal) {
    gl.flip = gl.flip || new Shader(null, '\
        uniform sampler2D texture;\
        uniform bool vertical;\
        uniform bool horizontal;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, vec2((horizontal) ? (1.0 - texCoord.x) : texCoord.x, (vertical) ? (1.0 - texCoord.y) : texCoord.y));\
            \
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.flip, {
        vertical: vertical ? 1 : 0,
        horizontal: horizontal ? 1 : 0
    });

    return this;
}

/**
 * @filter                Matrix Warp
 * @description           Transforms an image by a 2x2 or 3x3 matrix. The coordinates used in
 *                        the transformation are (x, y) for a 2x2 matrix or (x, y, 1) for a
 *                        3x3 matrix, where x and y are in units of pixels.
 * @param matrix          A 2x2 or 3x3 matrix represented as either a list or a list of lists.
 *                        For example, the 3x3 matrix [[2,0,0],[0,3,0],[0,0,1]] can also be
 *                        represented as [2,0,0,0,3,0,0,0,1] or just [2,0,0,3].
 * @param inverse         A boolean value that, when true, applies the inverse transformation
 *                        instead. (optional, defaults to false)
 * @param useTextureSpace A boolean value that, when true, uses texture-space coordinates
 *                        instead of screen-space coordinates. Texture-space coordinates range
 *                        from -1 to 1 instead of 0 to width - 1 or height - 1, and are easier
 *                        to use for simple operations like flipping and rotating.
 */
function matrixWarp(matrix, inverse, useTextureSpace) {
    gl.matrixWarp = gl.matrixWarp || warpShader('\
        uniform mat3 matrix;\
        uniform bool useTextureSpace;\
    ', '\
        if (useTextureSpace) coord = coord / texSize * 2.0 - 1.0;\
        vec3 warp = matrix * vec3(coord, 1.0);\
        coord = warp.xy / warp.z;\
        if (useTextureSpace) coord = (coord * 0.5 + 0.5) * texSize;\
    ');

    // Flatten all members of matrix into one big list
    matrix = Array.prototype.concat.apply([], matrix);

    // Extract a 3x3 matrix out of the arguments
    if (matrix.length == 4) {
        matrix = [
            matrix[0], matrix[1], 0,
            matrix[2], matrix[3], 0,
            0, 0, 1
        ];
    } else if (matrix.length != 9) {
        throw 'can only warp with 2x2 or 3x3 matrix';
    }

    simpleShader.call(this, gl.matrixWarp, {
        matrix: inverse ? getInverse(matrix) : matrix,
        texSize: [this.width, this.height],
        useTextureSpace: useTextureSpace | 0
    });

    return this;
}

/**
 * @filter           Move
 * @description      Translate an image horizontally and vertically
 * @param vertical   Number of pixels to move up or down
 * @param horizontal Number of pixels to move left or right
 */
function move(vertical, horizontal) {
    gl.move = gl.move || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float vertical;\
        uniform float horizontal;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, vec2(texCoord.x + horizontal, texCoord.y + vertical));\
            \
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.move, {
        vertical: clamp(-1.0, vertical / this._.texture.height, 1.0),
        horizontal: clamp(-1.0, horizontal / this._.texture.width, 1.0)
    });

    return this;
}

/**
 * @filter       Perspective
 * @description  Warps one quadrangle to another with a perspective transform. This can be used to
 *               make a 2D image look 3D or to recover a 2D image captured in a 3D environment.
 * @param before The x and y coordinates of four points before the transform in a flat list. This
 *               would look like [ax, ay, bx, by, cx, cy, dx, dy] for four points (ax, ay), (bx, by),
 *               (cx, cy), and (dx, dy).
 * @param after  The x and y coordinates of four points after the transform in a flat list, just
 *               like the other argument.
 */
function perspective(before, after) {
    var a = getSquareToQuad.apply(null, after);
    var b = getSquareToQuad.apply(null, before);
    var c = multiply(getInverse(a), b);
    return this.matrixWarp(c);
}

/**
 * @filter       Rotate
 * @description  Rotate image by a number of radians. Does not resize the texture.
 * @param angle  The angle in radians
 */
function rotate(angle) {
    return this.matrixWarp([
        Math.cos(angle), -Math.sin(angle), 0,
        Math.sin(angle), Math.cos(angle), 0,
        0, 0, 1
    ], false, true);
}

/**
 * @filter        Swirl
 * @description   Warps a circular region of the image in a swirl.
 * @param centerX The x coordinate of the center of the circular region.
 * @param centerY The y coordinate of the center of the circular region.
 * @param radius  The radius of the circular region.
 * @param angle   The angle in radians that the pixels in the center of
 *                the circular region will be rotated by.
 */
function swirl(centerX, centerY, radius, angle) {
    gl.swirl = gl.swirl || warpShader('\
        uniform float radius;\
        uniform float angle;\
        uniform vec2 center;\
    ', '\
        coord -= center;\
        float distance = length(coord);\
        if (distance < radius) {\
            float percent = (radius - distance) / radius;\
            float theta = percent * percent * angle;\
            float s = sin(theta);\
            float c = cos(theta);\
            coord = vec2(\
                coord.x * c - coord.y * s,\
                coord.x * s + coord.y * c\
            );\
        }\
        coord += center;\
    ');

    simpleShader.call(this, gl.swirl, {
        radius: radius,
        center: [centerX, centerY],
        angle: angle,
        texSize: [this.width, this.height]
    });

    return this;
}

/**
 * @filter       Zoom
 * @description  Zoom an image in or out. Takes one or two parameters. If one is given instead
 *               of two, then sx and sy are set to the same value.
 * @param sx     The x scaling factor, e.g. 1.5 for 150%
 * @param sy     The y scaling factor.
 */
function zoom(sx, sy) {
    if (sy === undefined) sy = sx;

    return this.matrixWarp([
        sx, 0, 0,
        0, sy, 0,
        0, 0, 1
    ], false, true);
}
