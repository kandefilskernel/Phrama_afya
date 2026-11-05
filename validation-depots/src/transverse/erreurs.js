export class ErreurMetier extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 400, 401, 403, 404, 409
  }
}
