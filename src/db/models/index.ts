import Client from './Client';
import Template from './Template';
import TemplateItem from './TemplateItem';
import MeasurementSet from './MeasurementSet';
import MeasurementItem from './MeasurementItem';
import MeasurementValue from './MeasurementValue';
import ImageRecord from './ImageRecord';
import AppSettings from './AppSettings';

export {
  Client,
  Template,
  TemplateItem,
  MeasurementSet,
  MeasurementItem,
  MeasurementValue,
  ImageRecord,
  AppSettings,
};

/** All model classes, for the WatermelonDB Database constructor. */
export const modelClasses = [
  Client,
  Template,
  TemplateItem,
  MeasurementSet,
  MeasurementItem,
  MeasurementValue,
  ImageRecord,
  AppSettings,
];
