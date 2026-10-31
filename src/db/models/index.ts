import Client from './Client';
import Template from './Template';
import TemplateItem from './TemplateItem';
import MeasurementSet from './MeasurementSet';
import MeasurementItem from './MeasurementItem';
import MeasurementValue from './MeasurementValue';
import ImageRecord from './ImageRecord';
import Job from './Job';
import JobItem from './JobItem';
import Payment from './Payment';
import AppSettings from './AppSettings';

export {
  Client,
  Template,
  TemplateItem,
  MeasurementSet,
  MeasurementItem,
  MeasurementValue,
  ImageRecord,
  Job,
  JobItem,
  Payment,
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
  Job,
  JobItem,
  Payment,
  AppSettings,
];
