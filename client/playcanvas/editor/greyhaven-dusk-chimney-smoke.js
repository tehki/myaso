// MYASO.IO — Greyhaven chimney smoke (Red Lion / Blacksmith).
// Visual-only FX. No gameplay, collision, world placement or server authority.
var GreyhavenDuskChimneySmoke = pc.createScript('greyhavenDuskChimneySmoke');
GreyhavenDuskChimneySmoke.attributes.add('duskByDefault', {
    type: 'boolean',
    default: true,
    title: 'Emit During Dusk'
});
GreyhavenDuskChimneySmoke.prototype.initialize = function () {
    var emitter = this.entity.particlesystem;
    if (!emitter) {
        console.warn('[MYASO] Missing chimney particle system:', this.entity.name);
        return;
    }
    var params = new URLSearchParams(window.location.search);
    var override = params.get('greyhavenTime');
    var isDusk = override === 'day' ? false :
        override === 'dusk' ? true : this.duskByDefault;
    emitter.stop();
    if (isDusk) {
        emitter.reset();
        emitter.play();
    }
    console.info('[MYASO] Chimney smoke:', this.entity.name, isDusk ? 'dusk' : 'day/off');
};
