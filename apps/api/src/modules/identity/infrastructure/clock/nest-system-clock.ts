import { Injectable } from '@nestjs/common';
import { SystemClock } from '@zoqo/shared';

@Injectable()
export class NestSystemClock extends SystemClock {}
