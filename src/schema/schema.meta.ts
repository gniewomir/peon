import { sDateTime, sNamespace, sString } from './schema.utils.js';
import { z } from 'zod';

export const metaObject = {
  offer: sNamespace(
    {
      id: sString('Job offer ID'),
      url: sString('Job offer URL'),
      source: sString('Job offer source'),
      publishedAt: sDateTime('Offer publication date and time'),
      expiresAt: sDateTime('Offer expiration date and time'),
      updatedAt: sDateTime('Offer last update date and time'),
      stagingPath: sString('Staging path'),
      cachePath: sString('Cache path'),
    },
    'Job offer metadata',
  ),
};
export const metaSchema = sNamespace(metaObject, 'Job offer metadata');
export type TMetaSchema = z.infer<typeof metaSchema>;
export const nullMetaSchema: TMetaSchema = {
  offer: {
    id: null,
    url: null,
    source: null,
    publishedAt: null,
    expiresAt: null,
    updatedAt: null,
    stagingPath: null,
    cachePath: null,
  },
};
