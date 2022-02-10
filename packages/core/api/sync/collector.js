import { CURRENT_DATABASE_VERSION } from "../../common";
import { getContentFromData } from "../../content-types";
import { diff } from "../../utils/array";
import Database from "../index";

class Collector {
  /**
   *
   * @param {Database} db
   */
  constructor(db) {
    this._db = db;
  }

  async collect(lastSyncedTimestamp) {
    this._lastSyncedTimestamp = lastSyncedTimestamp;
    this.key = await this._db.user.getEncryptionKey();
    return {
      notes: this._collect(await this._db.notes.encrypted()),
      notebooks: this._collect(await this._db.notebooks.encrypted()),
      content: this._collect(await this._db.content.encrypted()),
      attachments: this._collect(await this._db.attachments.encrypted()),
      settings: await this._encrypt(this._collect([this._db.settings.raw])),
      vaultKey: await this._serialize(await this._db.vault._getKey()),
    };
  }

  _serialize(item) {
    if (!item) return null;
    return this._db.storage.encrypt(this.key, JSON.stringify(item));
  }

  _encrypt(array) {
    if (!array.length) return [];
    return Promise.all(array.map(this._map, this));
  }

  /**
   *
   * @param {Array} array
   * @returns {Array}
   */
  _collect(array) {
    if (!array.length) return [];
    return array.reduce((prev, item) => {
      if (!item || item.localOnly) return prev;
      if (item.dateModified > this._lastSyncedTimestamp || item.migrated)
        prev.push(this._map(item));
      return prev;
    }, []);
  }

  _map(item) {
    return {
      id: item.id,
      v: CURRENT_DATABASE_VERSION,
      iv: item.iv,
      cipher: item.cipher,
      length: item.length,
      alg: item.alg,
      dateModified: item.dateModified,
    };
  }

  filter(data, predicate) {
    const arrays = ["notes", "notebooks", "content", "attachments", "settings"];
    const newData = {};
    for (let array of arrays) {
      if (!data[array]) continue;
      newData[array] = data[array].filter(predicate);
    }
    return newData;
  }
}
export default Collector;
