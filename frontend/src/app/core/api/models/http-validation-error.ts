import { ValidationError } from '../models/validation-error';
export interface HttpValidationError {
    detail?: Array<ValidationError>;
}
