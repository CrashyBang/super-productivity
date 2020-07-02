import * as moment from 'moment';
import { Duration } from 'moment';
import { RoundTimeOption } from '../features/project/project.model';

export const roundDuration = (val: Duration | number, roundTo: RoundTimeOption, isRoundUp = false): Duration => {
  const value = (typeof val === 'number')
    ? val
    : val.asMilliseconds();
  const roundedMs = roundDurationVanilla(value, roundTo, isRoundUp);
  return moment.duration({millisecond: roundedMs});
};

export const roundMinutes = (minutes, factor, isRoundUp) => {
  return (isRoundUp)
    ? Math.ceil(minutes / factor) * factor
    : Math.round(minutes / factor) * factor;
};

export const roundDurationVanilla = (val: number, roundTo: RoundTimeOption, isRoundUp = false): number => {
  const asMinutes = parseMsToMinutes(val);
  const MSF = 60000;

  switch (roundTo) {
    case '5M':
      return roundMinutes(asMinutes, 5, isRoundUp) * MSF;

    case 'QUARTER':
      return roundMinutes(asMinutes, 15, isRoundUp) * MSF;

    case 'HALF':
      return roundMinutes(asMinutes, 30, isRoundUp) * MSF;

    case 'HOUR':
      return roundMinutes(asMinutes, 60, isRoundUp) * MSF;

    default:
      return val;
  }
};

export const parseMsToMinutes = (ms: number): number => {
  return Math.round(ms / 60000);
};
