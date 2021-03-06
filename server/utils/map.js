import _ from 'lodash';
import { Observable } from 'rx';
import { Schema, valuesOf, arrayOf, normalize } from 'normalizr';

import { nameify } from '../utils';
import supportedLanguages from '../../common/utils/supported-languages';

const challenge = new Schema('challenge', { idAttribute: 'dashedName' });
const block = new Schema('block', { idAttribute: 'dashedName' });
const superBlock = new Schema('superBlock', { idAttribute: 'dashedName' });

block.define({
  challenges: arrayOf(challenge)
});

superBlock.define({
  blocks: arrayOf(block)
});

const mapSchema = valuesOf(superBlock);
let mapObservableCache;
/*
 * interface ChallengeMap {
 *   result: [superBlockDashedName: String]
 *   entities: {
 *     superBlock: {
 *       [superBlockDashedName: String]: {
 *          blocks: [blockDashedName: String]
 *        }
 *     },
 *     block: {
 *       [blockDashedName: String]: {
 *         challenges: [challengeDashedName: String]
 *       }
 *     },
 *     challenge: {
 *       [challengeDashedName: String]: Challenge
 *     }
 *   }
 * }
 */
export function cachedMap(Block) {
  if (mapObservableCache) {
    return mapObservableCache;
  }
  const query = {
    include: 'challenges',
    order: ['superOrder ASC', 'order ASC']
  };
  const map$ = Block.find$(query)
    .flatMap(blocks => Observable.from(blocks.map(block => block.toJSON())))
    .reduce((map, block) => {
      console.log('caching........................')
        console.log(map);
        console.log(block);
        console.log('*****************************')
        if (map[block.superBlock]) {
        map[block.superBlock].blocks.push(block);
      } else {
        map[block.superBlock] = {
          title: _.startCase(block.superBlock),
          order: block.superOrder,
          name: nameify(_.startCase(block.superBlock)),
          dashedName: block.superBlock,
          blocks: [block],
          message: block.superBlockMessage
        };
      }

      return map;
    }, {})
    .map(map => normalize(map, mapSchema))
    .map(map => {
        console.log('mapping.................')
        console.log(map.entities)
        console.log(map.entities.block)
        console.log(Object.keys(map.entities.block))
      // make sure challenges are in the right order
      map.entities.block = Object.keys(map.entities.block)
        // turn map into array
        .map(key => map.entities.block[key])
        // perform re-order
        .map(block => {
            console.log('huhuhua......................')
          block.challenges = block.challenges.reduce((accu, dashedName) => {
              console.log('doing..............................')
              console.log(map.entities.challenge[dashedName].suborder);
              console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
            const index = map.entities.challenge[dashedName].suborder;
            accu[index - 1] = dashedName;
            return accu;
          }, []);
          return block;
        })
        // turn back into map
        .reduce((blockMap, block) => {
            console.log(block)
          blockMap[block.dashedName] = block;
          return blockMap;
        }, {});
      return map;
    })
    .map(map => {
      // re-order superBlocks result
        console.log('+++++++++++++++++++++++++++++=====================================')
        console.log(map.result)
      const result = map.result.reduce((result, supName) => {

        const index = map.entities['superBlock'][supName].order;
        result[index] = supName;
        return result;
      }, []);
      return {
        ...map,
        result
      };
    })
    .shareReplay();
  mapObservableCache = map$;
  return map$;
}

export function mapChallengeToLang(
  { translations = {}, ...challenge },
  lang
) {
  if (!supportedLanguages[lang]) {
    lang = 'en';
  }
  const translation = translations[lang] || {};
  const isTranslated = Object.keys(translation).length > 0;
  if (lang !== 'en') {
    challenge = {
      ...challenge,
      ...translation,
      isTranslated
    };
  }
  return {
    ...challenge,
    isTranslated
  };
}

export function getMapForLang(lang) {
  return ({ entities: { challenge: challengeMap, ...entities }, result }) => {
    entities.challenge = Object.keys(challengeMap)
      .reduce((translatedChallengeMap, key) => {
        translatedChallengeMap[key] = mapChallengeToLang(
          challengeMap[key],
          lang
        );
        return translatedChallengeMap;
      }, {});
    return { result, entities };
  };
}
