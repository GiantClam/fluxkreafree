import BaseHashIds from "hashids";

import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

export const Hashids = (prefix: string, length = 12) => {
  // 在构建时使用默认salt
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：使用默认Hashids salt");
    return new BaseHashIds("build-time-salt", length);
  }
  
  const salt = `${env.HASHID_SALT}:${prefix}`
  console.log('salt-->', salt)
  return new BaseHashIds(salt, length);
};
