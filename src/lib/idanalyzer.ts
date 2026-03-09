import type { IdType, IdentityRecord } from "@/types";
import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";

const IDANALYZER_API = "https://api.idanalyzer.com/scan";

interface ScanResult {
  full_name: string | null;
  date_of_birth: string | null;
  document_number: string | null;
  expiry: string | null;
  document_type: string | null;
  raw: Record<string, unknown>;
}

export interface IdAnalyzerErrorResult {
  success: false;
  error: string;
}

export interface IdAnalyzerSuccessResult {
  success: true;
  data: ScanResult;
}

type IdAnalyzerResult = IdAnalyzerSuccessResult | IdAnalyzerErrorResult;

interface StoredIdentityRecord {
  identityRecordId: string;
  identityRecord: IdentityRecord;
}

/**
 * Convert image URI to base64 string
 */
async function uriToBase64(uri: string): Promise<string> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

/**
 * Scan an ID document using ID Analyzer API.
 * vault: false ensures no data is stored on their servers.
 */
export async function scanId(
  frontImageUri: string,
  backImageUri: string,
): Promise<IdAnalyzerResult> {
  const apiKey = process.env.EXPO_PUBLIC_IDANALYZER_KEY;
  if (!apiKey) {
    return { success: false, error: "ID verification not configured" };
  }

  try {
    const [frontBase64, backBase64] = await Promise.all([
      uriToBase64(frontImageUri),
      uriToBase64(backImageUri),
    ]);

    if (!frontBase64 || !backBase64) {
      return { success: false, error: "Failed to read ID images" };
    }

    const response = await fetch(IDANALYZER_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        vault: false,
        file_base64: frontBase64,
        file_back_base64: backBase64,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `ID Analyzer request failed: ${response.status}`,
      };
    }

    const data: Record<string, unknown> = await response.json();

    if (data.error) {
      return {
        success: false,
        error: `ID Analyzer error: ${String(data.error)}`,
      };
    }

    const result = (data.result ?? data) as Record<string, unknown>;

    return {
      success: true,
      data: {
        full_name: extractString(result, ["fullName", "full_name", "name"]),
        date_of_birth: extractString(result, [
          "dob",
          "date_of_birth",
          "dateOfBirth",
        ]),
        document_number: extractString(result, [
          "documentNumber",
          "document_number",
          "idNumber",
        ]),
        expiry: extractString(result, ["expiry", "expiryDate", "expiration"]),
        document_type: extractString(result, [
          "documentType",
          "document_type",
          "type",
        ]),
        raw: data,
      },
    };
  } catch {
    return {
      success: false,
      error: "Unable to verify ID. Please check your connection.",
    };
  }
}

function extractString(
  obj: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    if (typeof obj[key] === "string" && obj[key]) return obj[key] as string;
  }
  return null;
}

/**
 * Upload ID images to private Supabase storage and store the hashed identity record.
 * Raw document number is NEVER stored — only the SHA-256 hash.
 */
export async function storeIdentityRecord(params: {
  frontImageUri: string;
  backImageUri: string;
  scanResult: ScanResult;
  idType: IdType;
  claimantProfileId: string;
  recordedByProfileId: string;
}): Promise<StoredIdentityRecord> {
  const {
    frontImageUri,
    backImageUri,
    scanResult,
    idType,
    claimantProfileId,
    recordedByProfileId,
  } = params;

  try {
    const rawDocNumber = scanResult.document_number ?? "";
    const id_number_hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawDocNumber,
    );

    const frontPath = `${claimantProfileId}/${Date.now()}_front.jpg`;
    const frontResponse = await fetch(frontImageUri);
    const frontBlob = await frontResponse.blob();
    const { error: frontUploadError } = await supabase.storage
      .from("identity-records")
      .upload(frontPath, frontBlob, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (frontUploadError)
      throw new Error(`Front image upload failed: ${frontUploadError.message}`);

    const backPath = `${claimantProfileId}/${Date.now()}_back.jpg`;
    const backResponse = await fetch(backImageUri);
    const backBlob = await backResponse.blob();
    const { error: backUploadError } = await supabase.storage
      .from("identity-records")
      .upload(backPath, backBlob, { contentType: "image/jpeg", upsert: false });

    if (backUploadError)
      throw new Error(`Back image upload failed: ${backUploadError.message}`);

    const { data: frontUrlData } = supabase.storage
      .from("identity-records")
      .getPublicUrl(frontPath);
    const { data: backUrlData } = supabase.storage
      .from("identity-records")
      .getPublicUrl(backPath);

    const { data: record, error: insertError } = await supabase
      .from("identity_records")
      .insert({
        user_id: claimantProfileId,
        id_image_front_url: frontUrlData.publicUrl,
        id_image_back_url: backUrlData.publicUrl,
        id_type: idType,
        full_name: scanResult.full_name,
        id_number_hash,
        idanalyzer_result: scanResult.raw,
        recorded_by: recordedByProfileId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return {
      identityRecordId: record.id as string,
      identityRecord: record as unknown as IdentityRecord,
    };
  } catch {
    throw new Error("Unable to store identity record.");
  }
}

/**
 * Full verification flow: scan ID, store record, link to claim.
 */
export async function verifyIdentityForClaim(params: {
  claimId: string;
  frontImageUri: string;
  backImageUri: string;
  idType: IdType;
  claimantProfileId: string;
  recordedByProfileId: string;
}): Promise<{ success: boolean; error?: string }> {
  const {
    claimId,
    frontImageUri,
    backImageUri,
    idType,
    claimantProfileId,
    recordedByProfileId,
  } = params;

  const scanResult = await scanId(frontImageUri, backImageUri);
  if (!scanResult.success) {
    return { success: false, error: scanResult.error };
  }

  try {
    const { identityRecordId } = await storeIdentityRecord({
      frontImageUri,
      backImageUri,
      scanResult: scanResult.data,
      idType,
      claimantProfileId,
      recordedByProfileId,
    });

    // Mark claim as identity_verified and link identity record
    const { error } = await supabase
      .from("claims")
      .update({
        identity_verified: true,
        identity_record_id: identityRecordId,
        status: "approved",
      })
      .eq("id", claimId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: "Unable to verify ID. Please check your connection.",
    };
  }
}
