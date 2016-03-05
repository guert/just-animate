import {AnimationManager} from './app/AnimationManager';
import * as animations from './animations/_all';

const animationManager = new AnimationManager();

for (let animationName in animations) {
    if (animations.hasOwnProperty(animationName)) {
        const animationOptions = animations[animationName];
        animationManager.register(animationName, animationOptions)
    }
}

window ['Just'] = animationManager;
