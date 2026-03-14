declare module 'synth-audio' {
  export type MusicEngineGenerateParams = Record<string, unknown>;

  export type MusicEngineGenerateResult = {
    success: boolean;
    filePath?: string;
    duration?: number;
    message?: string;
    error?: string;
  };

  export type MusicEngineMixSectionsArgs = {
    verseWavPath: string;
    chorusWavPath: string;
    bridgeWavPath: string;
    outputPath: string;
    arrangement?: string[];
  };

  export type MusicEngineMixSectionsResult = {
    success: boolean;
    filePath?: string;
    totalDuration?: number;
    arrangement?: string;
    message: string;
    error?: string;
  };

  interface MusicEngineModule {
    generate(params: MusicEngineGenerateParams): Promise<MusicEngineGenerateResult>;
    mixSections(args: MusicEngineMixSectionsArgs): MusicEngineMixSectionsResult;
    validateAndNormalizeInput?(params: Record<string, unknown>): Record<string, unknown>;
  }

  const MusicEngine: MusicEngineModule;
  export default MusicEngine;
}
