export class Flood {
  constructor() {
    this.active = false;
  }

  get name() {
    return "flood";
  }

  activate() {
    this.active = true;
  }

  deactivate() {
    this.active = false;
  }

  trigger() {
    this.activate();
  }
}

// Keep the lowercase module binding available for existing callers.
export { Flood as flood };
export default Flood;
