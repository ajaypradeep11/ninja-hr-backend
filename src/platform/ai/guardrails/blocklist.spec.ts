import { scanBlocklist } from './blocklist';

describe('scanBlocklist', () => {
  it.each(['this is fucking ridiculous', 'what a load of sh1t', 'b*tch', 'you asshole'])(
    'blocks %s',
    (text) => expect(scanBlocklist(text)).toBe(true),
  );

  it.each(['I grew up in Scunthorpe', 'the class will assess it', 'a raccoon by a cocoon', ''])(
    'allows %s',
    (text) => expect(scanBlocklist(text)).toBe(false),
  );
});
