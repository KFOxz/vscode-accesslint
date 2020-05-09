declare module 'accesslint' {
  export default AccessLint;

  export var AccessLint: Verifier | undefined;

  export interface Verifier {
  }

  export interface Error {
    type: string,
    name: string,
    description: string,
    location: Location
  }

  export interface Location {
    startLine: number,
    endLine: number,
    startCol: number,
    endCol: number
  }
}
