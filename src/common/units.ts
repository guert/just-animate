import { isDefined, isNumber } from './type';
import { distanceExpression, percentageExpression, timeExpression, nil } from './resources';
import { invalidArg } from './errors';

export const stepNone: string = '=';
export const stepForward: string = '+=';
export const stepBackward: string = '-=';

export const em: string = 'em';
export const ex: string = 'ex';
export const ch: string = 'ch';
export const rem: string = 'rem';
export const vh: string = 'vh';
export const vw: string = 'vw';
export const vmin: string = 'vmin';
export const vmax: string = 'vmax';
export const px: string = 'px';
export const mm: string = 'mm';
export const q: string = 'q';
export const cm: string = 'cm';
export const inch: string = 'in';
export const point: string = 'pt';
export const pica: string = 'pc';
export const percent: string = '%';
export const millisecond: string = 'ms';
export const second: string = 's';

export function fromDistance(val: string | number): IUnit {
    if (!isDefined(val)) {
        return nil;
    }
    if (isNumber(val)) {
        return Unit(Number(val), px, stepNone);
    }

    const match = distanceExpression.exec(val as string);
    const unit = match[2];
    const value = parseFloat(match[1]);

    return Unit(value, unit, stepNone);
}

export function fromPercentage(val: string | number): IUnit {
    if (!isDefined(val)) {
        return nil;
    }
    if (isNumber(val)) {
        return Unit(Number(val), percent, stepNone);
    }

    const match = percentageExpression.exec(val as string);
    const value = parseFloat(match[1]);

    return Unit(value, percent, stepNone);
}


export function fromTime(val: string | number): IUnit {
    if (isNumber(val)) {
        return Unit(Number(val), millisecond, stepNone);
    }

    const match = timeExpression.exec(val as string);
    const step = match[1] || stepNone;
    const unit = match[3];
    const value = parseFloat(match[2]);

    let valueMs: number;
    if (unit === nil || unit === millisecond) {
        valueMs = value;
    } else if (unit === second) {
        valueMs = value * 1000;
    } else {
        throw invalidArg('format');
    }
    return Unit(valueMs, millisecond, step);
}

export function Unit(value: number, unit: string, step: string): IUnit {
    const self = this instanceof Unit ? this : Object.create(Unit.prototype);
    self.value = value;
    self.unit = unit;
    self.step = step;
    return self;
}

Unit.prototype = {
    step: nil as string,
    unit: nil as string,
    value: nil as number,

    toString(): string {
        return String(this.value) + this.unit;
    }
};

export interface IUnit {
    step: string;
    unit: string;
    value: number;
    toString(): string;
}