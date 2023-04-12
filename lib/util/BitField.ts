class BitField {
  bitfield: number;

  static FLAGS: {};

  private defaultBit: number;

  constructor(bits = 0) {
    this.defaultBit = 0;
    this.bitfield = this.resolve(bits);
  }

  any(bit: any): boolean {
    return (this.bitfield & this.resolve(bit)) !== this.defaultBit;
  }

  equals(bit: any): boolean {
    return this.bitfield === this.resolve(bit);
  }

  has(bit): boolean {
    bit = this.resolve(bit);
    return (this.bitfield & bit) == bit;
  }

  missing(bits: number, ...hasParams: any[]): string[] {
    return new BitField(bits).remove(this).toArray(...hasParams);
  }

  freeze(): Readonly<BitField> {
    return Object.freeze(this);
  }

  add(...bits): BitField {
    let total = this.defaultBit;
    for (const bit of bits) {
      total |= this.resolve(bit);
    }
    if (Object.isFrozen(this)) return new BitField(this.bitfield | total);
    this.bitfield |= total;
    return total;
  }

  static resolve(bit): number | bigint {
    const { defaultBit } = this;
    if (typeof defaultBit === typeof bit && bit >= defaultBit) return bit;
  }
}

BitField.FLAGS = {};
