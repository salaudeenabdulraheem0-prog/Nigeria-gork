(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "nigeria-gork-jobs-v1";
  let mode = "video";
  let selectedImage = null;
  let currentBrief = "";
  let toastTimer;

  const modeTitle = { video: "Create a cinematic video", image: "Prepare an image prompt", voice: "Prepare a voiceover" };
  const modePlaceholder = {
    video: "Example: A cinematic aerial shot of Lagos at sunset, yellow danfo buses moving through the streets, warm golden light, smooth camera movement...",
    image: "Example: A cinematic portrait of Lagos at golden hour, natural skin texture, dramatic light, realistic photography...",
    voice: "Write the narration you want spoken. Example: Lagos — where dreams rise, energy never sleeps, and every street tells a story."
  };
  const iconForMode = { video: "▣", image: "▧", voice: "♫" };

  function notify(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
  }
  function getJobs() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }
  function saveJobs(jobs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, 30)));
      return true;
    } catch (_) {
      notify("Could not save history on this device. Storage may be full.");
      return false;
    }
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }
  function setMode(nextMode) {
    mode = nextMode;
    document.querySelectorAll(".tab").forEach(btn => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    $("modeTitle").textContent = modeTitle[mode];
    $("prompt").placeholder = modePlaceholder[mode];
    const isVideo = mode === "video";
    $("durationField").hidden = !isVideo;
    $("ratioField").hidden = !isVideo;
    $("audioOptions").hidden = !isVideo;
    $("referenceImage").accept = "image/*";
  }
  function formatDate(iso) {
    try { return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch (_) { return iso; }
  }
  function renderHistory() {
    const jobs = getJobs();
    $("emptyHistory").hidden = jobs.length > 0;
    $("historyList").innerHTML = jobs.map(job => `
      <article class="history-item" data-id="${escapeHtml(job.id)}">
        <div class="history-thumb">${iconForMode[job.mode] || "✦"}</div>
        <div class="history-copy">
          <strong>${escapeHtml(job.title || "Untitled creation")}</strong>
          <span>${escapeHtml((job.mode || "video").toUpperCase())} · ${escapeHtml(job.language || "English")} · ${escapeHtml(formatDate(job.createdAt))}</span>
          <span>Local brief only — media not generated</span>
        </div>
        <button class="icon-btn open-job" type="button" data-id="${escapeHtml(job.id)}" aria-label="Open ${escapeHtml(job.title || "job")}">›</button>
      </article>`).join("");
    $("clearHistory").hidden = jobs.length === 0;
  }
  async function createBrief() {
    const prompt = $("prompt").value.trim();
    if (!prompt) {
      $("prompt").focus();
      notify("Enter a prompt first.");
      return;
    }

    if (mode === "video") {
      const ratio = document.querySelector('input[name="ratio"]:checked')?.value || "9:16";
      const submitButton = $("creationForm").querySelector('button[type="submit"]');
      if (submitButton) { submitButton.disabled = true; submitButton.dataset.oldText = submitButton.textContent; submitButton.textContent = "Submitting video…"; }
      try {
        const response = await fetch("/.netlify/functions/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, aspect_ratio: ratio })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Video request failed.");
        const detail = [
          "NIGERIA GORK — VIDEO REQUEST",
          "Status: Submitted to Magic Hour",
          "Project ID: " + (data.project_id || "Check your Magic Hour project history"),
          "Credits charged: " + (data.credits_charged == null ? "Check your Magic Hour account" : data.credits_charged),
          "",
          data.message || "Your request was accepted. Generation may take time.",
          "",
          "View your projects: https://magichour.ai/my-library"
        ].join("\n");
        currentBrief = detail;
        $("dialogTitle").textContent = "Video request submitted";
        $("jobBrief").textContent = detail;
        if (typeof $("jobDialog").showModal === "function") $("jobDialog").showModal(); else alert(detail);
        notify("Video request submitted.");
        return;
      } catch (error) {
        notify(error.message || "Video request failed.");
        $("dialogTitle").textContent = "Video request failed";
        $("jobBrief").textContent = (error.message || "Video request failed.") + "\n\nCheck your Netlify function setup, API key setting, Magic Hour API access, and available credits.";
        if (typeof $("jobDialog").showModal === "function") $("jobDialog").showModal(); else alert($("jobBrief").textContent);
        return;
      } finally {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.oldText || "Generate"; }
      }
    }

    notify("Image and voice generation are not connected yet. Video is the first connected feature.");
    return;
    const ratio = document.querySelector('input[name="ratio"]:checked')?.value || "9:16";
    const job = {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
      mode,
      title: prompt.split(/\s+/).slice(0, 7).join(" ") + (prompt.split(/\s+/).length > 7 ? "…" : ""),
      prompt,
      imageName: selectedImage ? selectedImage.name : "",
      language: $("language").value,
      duration: mode === "video" ? $("duration").value + " seconds" : "Not applicable",
      ratio: mode === "video" ? ratio : "Not applicable",
      voiceover: mode === "video" ? $("voiceover").checked : mode === "voice",
      backgroundSound: mode === "video" ? $("sound").checked : false,
      status: "Prototype only — not generated",
      createdAt: new Date().toISOString()
    };
    const jobs = getJobs();
    jobs.unshift(job);
    saveJobs(jobs);
    currentBrief = buildBrief(job);
    $("dialogTitle").textContent = "Creation brief prepared";
    $("jobBrief").textContent = currentBrief;
    if (typeof $("jobDialog").showModal === "function") $("jobDialog").showModal();
    else alert(currentBrief);
    renderHistory();
  }
  function buildBrief(job) {
    const kind = job.mode === "video" ? "Cinematic video" : job.mode === "image" ? "AI image" : "Voiceover";
    return [
      "NIGERIA GORK — CREATION BRIEF",
      "STATUS: PROTOTYPE ONLY. NO MEDIA HAS BEEN GENERATED.",
      "",
      "Mode: " + kind,
      "Prompt: " + job.prompt,
      "Reference image: " + (job.imageName || "None"),
      "Language: " + job.language,
      "Duration: " + job.duration,
      "Aspect ratio: " + job.ratio,
      "Voiceover requested: " + (job.voiceover ? "Yes" : "No"),
      "Background sound requested: " + (job.backgroundSound ? "Yes" : "No"),
      "",
      "Suggested cinematic direction:",
      "Use realistic lighting, intentional camera movement, natural motion, coherent composition, and an appropriate ending. Keep the subject consistent. Avoid unwanted text, logos, watermarks, and visual distortions.",
      "",
      "Next step: Connect a secure backend and a supported generation provider to turn this brief into real media."
    ].join("\n");
  }

  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
  $("chooseImage").addEventListener("click", () => $("referenceImage").click());
  $("uploadBox").addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    $("referenceImage").click();
  });
  $("referenceImage").addEventListener("change", () => {
    const file = $("referenceImage").files && $("referenceImage").files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify("Choose an image file."); return; }
    const maxBytes = 12 * 1024 * 1024;
    if (file.size > maxBytes) { notify("Choose an image smaller than 12 MB."); $("referenceImage").value = ""; return; }
    if (selectedImage && selectedImage.previewUrl) URL.revokeObjectURL(selectedImage.previewUrl);
    selectedImage = { name: file.name, size: file.size, file, previewUrl: URL.createObjectURL(file) };
    $("imagePreview").src = selectedImage.previewUrl;
    $("imageName").textContent = file.name;
    $("imageSize").textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB · selected on this device";
    $("imagePreviewWrap").hidden = false;
  });
  $("removeImage").addEventListener("click", () => {
    if (selectedImage?.previewUrl) URL.revokeObjectURL(selectedImage.previewUrl);
    selectedImage = null;
    $("referenceImage").value = "";
    $("imagePreview").removeAttribute("src");
    $("imagePreviewWrap").hidden = true;
  });
  $("creationForm").addEventListener("submit", (event) => {
    event.preventDefault();
    createBrief();
  });
  $("historyList").addEventListener("click", (event) => {
    const button = event.target.closest(".open-job");
    if (!button) return;
    const job = getJobs().find(item => item.id === button.dataset.id);
    if (!job) return;
    currentBrief = buildBrief(job);
    $("dialogTitle").textContent = job.title || "Creation brief";
    $("jobBrief").textContent = currentBrief;
    if (typeof $("jobDialog").showModal === "function") $("jobDialog").showModal();
    else alert(currentBrief);
  });
  $("clearHistory").addEventListener("click", () => {
    if (!getJobs().length) return;
    if (confirm("Clear all locally saved job briefs from this device?")) {
      localStorage.removeItem(STORAGE_KEY);
      renderHistory();
      notify("Local history cleared.");
    }
  });
  function closeDialog() { $("jobDialog").close(); }
  $("closeDialog").addEventListener("click", closeDialog);
  $("doneDialog").addEventListener("click", closeDialog);
  $("jobDialog").addEventListener("click", (event) => {
    if (event.target === $("jobDialog")) closeDialog();
  });
  $("copyBrief").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(currentBrief);
      notify("Brief copied.");
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = currentBrief;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); notify("Brief copied."); }
      catch (__) { notify("Copy unavailable. Select and copy the text manually."); }
      area.remove();
    }
  });

  setMode("video");
  renderHistory();

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {
      console.info("Service worker registration skipped.");
    }));
  }
})();
