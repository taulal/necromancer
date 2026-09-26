import {describe, expect, test} from 'vitest'
import {missingAltPaths, replaceStrings} from './ritualHandlers'

describe('missingAltPaths', () => {
  test('finds hero, gallery and card images with an asset but no alt', () => {
    const asset = {_ref: 'image-a'}
    const paths = missingAltPaths({
      body: [
        {_key: 'h', _type: 'hero', image: {asset}},
        {_key: 'm', _type: 'mediaText', image: {asset, alt: 'Already described'}},
        {
          _key: 'g',
          _type: 'gallery',
          images: [
            {_key: 'g1', image: {asset}},
            {_key: 'g2', image: {asset}, alt: 'ok'},
          ],
        },
        {_key: 'c', _type: 'cardGrid', cards: [{_key: 'c1', image: {asset}}]},
        {_key: 'r', _type: 'richText', body: []},
      ],
    })
    expect(paths).toEqual([
      ['body', {_key: 'h'}, 'image', 'alt'],
      ['body', {_key: 'g'}, 'images', {_key: 'g1'}, 'alt'],
      ['body', {_key: 'c'}, 'cards', {_key: 'c1'}, 'image', 'alt'],
    ])
  })
})

describe('replaceStrings', () => {
  test('replaces wrong contact values everywhere except system keys', () => {
    const doc = {
      _id: 'versions.r1.page-contact',
      _type: 'page',
      body: [
        {
          _key: 'a',
          _type: 'richText',
          body: [{_type: 'block', children: [{_type: 'span', text: 'Call 0151 555 0199 today'}]}],
        },
      ],
      phone: '0151 555 0199',
    }
    const {value, changed} = replaceStrings(doc, ['0151 555 0199'], '0151 555 0100')
    expect(changed).toBe(2)
    expect(value.phone).toBe('0151 555 0100')
    expect(JSON.stringify(value)).not.toContain('0199')
    expect(value._id).toBe(doc._id)
  })
})
