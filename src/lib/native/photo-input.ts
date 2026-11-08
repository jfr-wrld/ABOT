/**
 * Opens a hidden `<input type="file" accept="image/*">`, either as the gallery or straight to
 * the camera. The Android app's WebView only offers the camera when the input asks to capture,
 * so the camera choice sets `capture` for that one tap.
 */
export function openPhotoInput(input: HTMLInputElement | null, source: "gallery" | "camera", facing: "user" | "environment" = "environment") {
  if (!input) return;
  if (source === "camera") input.setAttribute("capture", facing);
  else input.removeAttribute("capture");
  input.click();
}
