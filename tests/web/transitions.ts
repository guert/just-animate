import * as assert from 'assert';
import { animate } from '../../src/main';
import { addPlugin, removePlugin } from '../../src/lib/plugins'
import { waapiPlugin } from '../../src/web/index'

describe('transitions', () => {
  before(() => addPlugin(waapiPlugin))
  after(() => removePlugin(waapiPlugin))

  /* nothing so far */
  it('transitions to the property value when not set as an array', () => {
    const target = document.createElement('div')
    target.style.opacity = '1'
    document.body.appendChild(target)

    const timeline = animate({
      targets: target,
      duration: 1000,
      props: {
        opacity: 0
      }
    })

    timeline.pause()

    timeline.currentTime = 0
    assert.equal(getComputedStyle(target).opacity, '1');

    timeline.currentTime = 500
    assert.equal(getComputedStyle(target).opacity, '0.5');

    timeline.currentTime = 1000
    assert.equal(getComputedStyle(target).opacity, '0');

    document.body.removeChild(target)
  });
});