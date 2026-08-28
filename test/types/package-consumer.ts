import * as root from '@arclabs561/ai-visual-test';
import * as validators from '@arclabs561/ai-visual-test/validators';
import * as temporal from '@arclabs561/ai-visual-test/temporal';
import * as multiModal from '@arclabs561/ai-visual-test/multi-modal';
import * as ensemble from '@arclabs561/ai-visual-test/ensemble';
import * as video from '@arclabs561/ai-visual-test/video';
import * as extractors from '@arclabs561/ai-visual-test/extractors';
import * as persona from '@arclabs561/ai-visual-test/persona';
import * as utils from '@arclabs561/ai-visual-test/utils';
import * as game from '@arclabs561/ai-visual-test/game';
import * as errors from '@arclabs561/ai-visual-test/errors';
import * as playwright from '@arclabs561/ai-visual-test/playwright';
import * as vitest from '@arclabs561/ai-visual-test/vitest';
import * as jest from '@arclabs561/ai-visual-test/jest';
import * as perception from '@arclabs561/ai-visual-test/perception';

export const publicModules = {
  root, validators, temporal, multiModal, ensemble, video, extractors,
  persona, utils, game, errors, playwright, vitest, jest, perception,
};
