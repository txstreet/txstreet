/*
    Metal backend for Angle used by Apple on Safari and iOS devices is broken.
    Until that isn't fixed, we have to use isABadApple method.
    When the problem is fixed, it can be done away with to reduce complexity.
    Or, it can just return false until apple screws something up once again.
*/

class AppleTest {
    constructor() {

    }

    isABadApple() {
        const ua = navigator.userAgent.toLowerCase();

        let appleIOS = /ipad|iphone/.test(ua);
        let safari = /safari/.test(ua);
        let chrome = /chrome/.test(ua);

        if (appleIOS) return true;

        if (safari && !chrome) {
            return true;
        } else {
            return false;
        }
    }
}

export default AppleTest;