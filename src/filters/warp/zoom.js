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
