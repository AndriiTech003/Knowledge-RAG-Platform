export interface ValidationError {
    ctx?: {};
    input?: any;
    loc: Array<(string | number)>;
    msg: string;
    type: string;
}
