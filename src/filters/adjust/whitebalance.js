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
